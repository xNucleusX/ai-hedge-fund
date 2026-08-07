"""Vercel serverless function: run one live fund cycle.

POST /api/run
    {
      "tickers": ["AAPL", "MSFT"],
      "analysts": ["buffett", "munger", "pead"],
      "capital": 100000,
      "max_position_pct": 0.25,
      "max_gross_exposure": 1.0,
      "date": "2026-08-07",        // optional, default: today
      "model": "claude-sonnet-5"   // optional, only used by LLM analysts
    }

Builds a one-strategy FundSpec from the request, wires up a SimBroker and
the Financial Datasets client, and runs `hedge_fund.pipeline.run_cycle` —
the exact same engine the `aihf` terminal app and the backtester use. The
response body is the CycleRecord, serialized exactly as the CLI prints it.

The hedge_fund package expects a writable `~/.hedge-fund/` for its on-disk
caches (LLM prompt cache, market-data cache). Vercel's Python runtime only
guarantees /tmp is writable, so HOME is pinned there before the package is
imported — every import below this line must stay below the os.environ set.
"""

from __future__ import annotations

import json
import os
import traceback
from datetime import date as _date
from http.server import BaseHTTPRequestHandler

os.environ.setdefault("HOME", "/tmp")

from hedge_fund.data import CachedDataClient, FDClient, FDClientError  # noqa: E402
from hedge_fund.brokers import SimBroker  # noqa: E402
from hedge_fund.fund import Fund, FundSpec, ModelSpec, StrategySpec  # noqa: E402
from hedge_fund.llm.registry import provider_for  # noqa: E402
from hedge_fund.pipeline import run_cycle  # noqa: E402
from hedge_fund.risk.limits import RiskLimits  # noqa: E402
from hedge_fund.signals import ALPHA_MODEL_REGISTRY  # noqa: E402

MAX_TICKERS = 8
MAX_ANALYSTS = len(ALPHA_MODEL_REGISTRY)


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400) -> None:
        super().__init__(message)
        self.status = status


def _build_spec(body: dict) -> tuple[FundSpec, list[str], str]:
    tickers = body.get("tickers")
    if not isinstance(tickers, list) or not tickers:
        raise ApiError("`tickers` must be a non-empty list of symbols.")
    tickers = [str(t).strip().upper() for t in tickers if str(t).strip()]
    if not tickers:
        raise ApiError("`tickers` must be a non-empty list of symbols.")
    if len(tickers) > MAX_TICKERS:
        raise ApiError(f"at most {MAX_TICKERS} tickers per run on this dashboard.")

    analysts = body.get("analysts")
    if not isinstance(analysts, list) or not analysts:
        raise ApiError("`analysts` must be a non-empty list.")
    unknown = [a for a in analysts if a not in ALPHA_MODEL_REGISTRY]
    if unknown:
        raise ApiError(
            f"unknown analyst(s): {', '.join(unknown)}. "
            f"available: {', '.join(sorted(ALPHA_MODEL_REGISTRY))}"
        )

    try:
        capital = float(body.get("capital", 100_000))
    except (TypeError, ValueError):
        raise ApiError("`capital` must be a number.")
    if capital <= 0:
        raise ApiError("`capital` must be positive.")

    try:
        max_position_pct = float(body.get("max_position_pct", 0.25))
        max_gross_exposure = float(body.get("max_gross_exposure", 1.0))
    except (TypeError, ValueError):
        raise ApiError("risk limits must be numbers.")

    as_of = body.get("date") or _date.today().isoformat()
    try:
        _date.fromisoformat(as_of)
    except ValueError:
        raise ApiError("`date` must be YYYY-MM-DD.")

    model = body.get("model")
    if model:
        model = str(model)
        provider = provider_for(model)
        if provider is not None and provider != "Anthropic":
            raise ApiError(
                f"model {model!r} needs the {provider} provider, which this "
                "dashboard doesn't bundle (Anthropic-only, to keep the "
                "serverless function within Vercel's size limit — run the "
                "`aihf` CLI locally for the full provider registry)."
            )
        os.environ["HEDGE_FUND_LLM_MODEL"] = model

    try:
        spec = FundSpec(
            name="dashboard-run",
            strategies=[
                StrategySpec(
                    name="dashboard",
                    models=[ModelSpec(name=a) for a in analysts],
                )
            ],
            risk=RiskLimits(
                max_position_pct=max_position_pct,
                max_gross_exposure=max_gross_exposure,
            ),
            capital=capital,
        )
    except Exception as exc:  # pydantic ValidationError, mostly
        raise ApiError(f"invalid fund spec: {exc}")

    return spec, tickers, as_of


def _run(body: dict) -> dict:
    spec, tickers, as_of = _build_spec(body)

    try:
        fund = Fund(spec)
    except ValueError as exc:
        # e.g. a missing LLM provider API key — make_llm() raises with the
        # exact env var name, which is the one thing the caller can act on.
        raise ApiError(str(exc), status=400)

    broker = SimBroker(cash=spec.capital)
    try:
        with FDClient() as raw:
            data_client = CachedDataClient(raw)
            record = run_cycle(fund, as_of, broker, data_client, tickers)
    except FDClientError as exc:
        raise ApiError(f"market data request failed: {exc}", status=502)
    except ValueError as exc:
        raise ApiError(str(exc), status=400)

    return json.loads(record.model_dump_json())


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        self._send_json(200, {"ok": True, "analysts": sorted(ALPHA_MODEL_REGISTRY)})

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(raw_body or b"{}")
            except json.JSONDecodeError:
                raise ApiError("request body must be valid JSON.")
            if not isinstance(body, dict):
                raise ApiError("request body must be a JSON object.")

            result = _run(body)
            self._send_json(200, result)
        except ApiError as exc:
            self._send_json(exc.status, {"error": str(exc)})
        except Exception as exc:  # last resort — never leak a bare 500 with no message
            traceback.print_exc()
            self._send_json(500, {"error": f"internal error: {exc}"})
