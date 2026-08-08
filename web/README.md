# AI Hedge Fund — Dashboard

A browser front end for the `aihf` engine: pick tickers, staff a fund with
LLM investor agents and quant models, and run one live cycle. It calls the
exact same pipeline (`hedge_fund.pipeline.run_cycle`) the `aihf` terminal
app and backtester use — nothing here re-implements the fund logic.

**Educational use only.** Runs against live market data and (for LLM
analysts) a real model call, but never places an actual trade — the broker
is `SimBroker`, an in-memory fill simulator.

## Stack

- **Frontend** — Next.js 14 (App Router) + TypeScript + Tailwind, in `app/`
  and `components/`.
- **API** — `api/run.py`, a Python serverless function (Vercel's Python
  runtime) that builds a one-strategy `FundSpec` from the request and calls
  `run_cycle`.
- **Engine** — `api/hedge_fund/` is a *trimmed, vendored* copy of the
  `hedge_fund/` package at the repo root (see the docstring in
  `api/hedge_fund/__init__.py` for why it's copied rather than imported by
  path or installed from PyPI). It excludes `backtesting/`, `event_study/`,
  `tui/`, and `validation/` — none of which this endpoint reaches — because
  those pull in scipy, matplotlib, and textual, and would push the deployed
  function well past Vercel's serverless function size limit.

## Function size

Vercel's Python runtime does no tree-shaking — a function bundles every
project file reachable at build time, and its dependencies are measured
uncompressed. Two things keep this one small, and both matter:

- `vercel.json` sets `excludeFiles` so the frontend (`node_modules/`,
  `.next/`, `app/`, `components/`, `lib/`, `public/`) is kept out of the
  Python bundle. Without it, `node_modules` alone would dominate it.
- `requirements.txt` omits pandas and numpy. They were reachable only from
  `signals/base.py`'s `QuantModel` helpers, which no shipped model calls;
  together they are ~158MB. With them the installed deps measure **241MB**
  against a 250MB limit — deployable today, and broken the moment a
  transitive dep grows. Without them: **77MB**.

If you add a quant model that genuinely needs numpy or pandas, add it back
to `requirements.txt` and re-check the total — you'll have roughly 170MB of
headroom to work with, and `signals/base.py` documents what was changed.

## Why Anthropic-only

The full `aihf` package supports Anthropic, OpenAI, xAI, DeepSeek, Google,
and Kimi. This dashboard bundles `langchain-anthropic` alone —
`langchain-openai`/`-google-genai`/`-xai`/`-deepseek` each add 20-45MB
(mostly provider SDKs and, for Google, grpc), and the deployed function is
already close to the platform's size limit with pandas + numpy alone. If
you need another provider, run `pip install aihf` and use the `aihf` CLI
locally — same engine, full registry.

## Local development

`next dev` serves the frontend but does not run Python, so the API needs
its own process. Two terminals:

```bash
# terminal 1 — the Python function
cd web/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r ../requirements.txt
export ANTHROPIC_API_KEY=... FINANCIAL_DATASETS_API_KEY=...
python3 dev_server.py            # serves the real handler on :5328
```

```bash
# terminal 2 — the frontend
cd web
npm install
cp .env.example .env.local       # FINANCIAL_DATASETS_API_KEY, ANTHROPIC_API_KEY
npm run dev                      # http://localhost:3000
```

`next.config.mjs` rewrites `/api/*` to `127.0.0.1:5328` **in development
only**, so the browser calls the same `/api/run` path it will call in
production. The rewrite is not emitted into production builds — there
Vercel routes `/api/run` straight to the function.

`dev_server.py` runs the same `handler` class Vercel invokes, so what you
exercise locally is what deploys. (`vercel dev` also works and runs both
runtimes in one process, if you prefer the CLI.)

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this from a
   clone) and [import it into Vercel](https://vercel.com/new).
2. Set the project's **Root Directory** to `web`.
3. Vercel auto-detects Next.js for the frontend and `api/run.py` as a
   Python serverless function — no framework override needed. Note this
   works because there is no `app/api/` directory: Vercel gives the root
   `api/` directory priority for `/api/*`, so adding Next.js route handlers
   under `app/api/` later would shadow them and break `/api/run`.
4. Add environment variables (Project → Settings → Environment Variables):
   - `FINANCIAL_DATASETS_API_KEY`
   - `ANTHROPIC_API_KEY`
5. Deploy.

`vercel.json` caps `api/run.py` at 60s / 1024MB, the max Vercel allows
without a Pro plan. A cycle with several LLM analysts across several
tickers calls the model once per (analyst, ticker) pair sequentially, so a
run with 5 analysts × 5 tickers can take a couple of minutes — if you hit
the timeout, either request fewer tickers/analysts per run, or raise
`maxDuration` (Pro plans allow up to 300s).

## Continuous deployment

### Every push deploys

This is Vercel's Git integration, not something configured here: once the
repo is connected, a push to `main` triggers a production deploy and every
PR gets its own preview URL. Nothing in this repo needs to run for that.

It applies to automated pushes too — a push made by `GITHUB_TOKEN` doesn't
trigger *other GitHub Actions workflows*, but Vercel deploys off its own
webhook, so the scheduled sync below still deploys normally.

### Upstream changes sync automatically

`.github/workflows/sync-upstream.yml` merges `virattt/ai-hedge-fund` into
`main` hourly, and can be run on demand from the Actions tab (with a
**dry run** option that verifies without pushing).

It is **not** realtime, and can't be: upstream is someone else's
repository, so there's no webhook to subscribe to — this polls. GitHub also
runs scheduled workflows on a best-effort basis and drops them under load,
so treat the cadence as "about hourly" and use the manual trigger when you
want it now.

Each run merges upstream, **re-vendors `api/hedge_fund/`**, verifies the
merged tree builds and still fits the size budget, and only then pushes.
The re-vendor step is the one that matters: the deployed site runs the
vendored copy, so a sync that updated only the root package would look
like it worked and change nothing in production.

### When the sync stops

It stops rather than guessing, and both cases need a human:

- **Merge conflict.** Resolve locally, then `python3 scripts/vendor_web_api.py`.
- **Upstream changed a file carrying local edits** — `signals/base.py` (the
  numpy/pandas trim) or `__init__.py` (the vendoring note). Re-apply the
  edit against the new upstream version, then update
  `api/hedge_fund/.vendor-manifest.json` with the new root-file hash.
  Re-running the vendor script after porting does this for you.

Check drift at any time:

```bash
python3 scripts/vendor_web_api.py --check   # CI runs this on every push
python3 scripts/vendor_web_api.py           # re-vendor
```

### Repo settings this needs

- **Settings → Actions → General → Workflow permissions**: *Read and write*,
  so the sync can push to `main`.
- If `main` is protected, the push will fail — either allow the Actions bot
  through, or change the last step to open a PR instead.

## API

`POST /api/run`

```json
{
  "tickers": ["AAPL", "MSFT"],
  "analysts": ["buffett", "munger", "pead"],
  "capital": 100000,
  "max_position_pct": 0.25,
  "max_gross_exposure": 1.0,
  "date": "2026-08-07",
  "model": "claude-sonnet-5"
}
```

Returns the `CycleRecord` JSON (marks, per-strategy signals with
reasoning, risk clamps, orders, resulting NAV) — the same shape
`aihf <mandate> --tickers ...` prints to stdout. Errors come back as
`{"error": "..."}` with a 4xx/5xx status.

`GET /api/run` returns `{"ok": true, "analysts": [...]}` as a health check.
