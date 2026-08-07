"use client";

import { useMemo, useState } from "react";
import { ANALYSTS, LLM_MODELS } from "@/lib/analysts";
import type { ApiError, CycleRecord, RunRequest } from "@/lib/types";
import ConvictionBar from "./ConvictionBar";

const DEFAULT_TICKERS = "AAPL, MSFT, NVDA";
const DEFAULT_ANALYSTS = new Set(["buffett", "munger", "pead"]);

type Status = "idle" | "loading" | "error" | "done";

export default function Dashboard() {
  const [tickersInput, setTickersInput] = useState(DEFAULT_TICKERS);
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_ANALYSTS);
  const [capital, setCapital] = useState(100000);
  const [maxPositionPct, setMaxPositionPct] = useState(0.25);
  const [maxGrossExposure, setMaxGrossExposure] = useState(1.0);
  const [model, setModel] = useState(LLM_MODELS[0].id);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<CycleRecord | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tickers = useMemo(
    () =>
      tickersInput
        .split(/[,\s]+/)
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    [tickersInput]
  );

  const usesLlm = useMemo(
    () => [...selected].some((id) => ANALYSTS.find((a) => a.id === id)?.kind === "llm"),
    [selected]
  );

  function toggleAnalyst(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function runCycle() {
    if (tickers.length === 0) {
      setError("Add at least one ticker.");
      setStatus("error");
      return;
    }
    if (selected.size === 0) {
      setError("Pick at least one analyst to staff the fund.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError(null);
    setRecord(null);

    const body: RunRequest = {
      tickers,
      analysts: [...selected],
      capital,
      max_position_pct: maxPositionPct,
      max_gross_exposure: maxGrossExposure,
      model,
    };

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data as ApiError).error || `request failed (${res.status})`);
      }
      setRecord(data as CycleRecord);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-baseline justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            AI Hedge Fund <span className="text-accent">/</span> Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Staff a fund with LLM investor agents and quant models, then run one live cycle.
          </p>
        </div>
        <a
          href="https://github.com/virattt/ai-hedge-fund"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-gray-500 hover:text-accent"
        >
          github.com/virattt/ai-hedge-fund ↗
        </a>
      </header>

      <div className="mb-6 rounded-lg border border-border bg-panel/60 px-4 py-3 text-xs text-gray-400">
        <strong className="text-gray-300">Educational use only.</strong> This runs the real
        pipeline against live market data and, for LLM analysts, a real model call — it does
        not place any actual trades. Not investment advice.
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* Build panel */}
        <section className="space-y-6 rounded-xl border border-border bg-panel p-5">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Tickers
            </label>
            <input
              value={tickersInput}
              onChange={(e) => setTickersInput(e.target.value)}
              placeholder="AAPL, MSFT, NVDA"
              className="w-full rounded-md border border-border bg-ink px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Free data for AAPL, GOOGL, MSFT, NVDA, TSLA. Others need a Financial Datasets key.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Analysts ({selected.size} staffed)
            </label>
            <div className="space-y-2">
              {ANALYSTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAnalyst(a.id)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                    selected.has(a.id)
                      ? "border-accent/60 bg-accent/10"
                      : "border-border bg-ink hover:border-gray-600"
                  }`}
                >
                  <span
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border ${
                      selected.has(a.id) ? "border-accent bg-accent" : "border-gray-600"
                    }`}
                  />
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{a.name}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                          a.kind === "llm"
                            ? "bg-accent/20 text-accent"
                            : "bg-gray-700/40 text-gray-300"
                        }`}
                      >
                        {a.kind === "llm" ? "LLM agent" : "quant"}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">{a.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {usesLlm && (
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                LLM model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-border bg-ink px-3 py-2 text-sm text-white outline-none focus:border-accent"
              >
                {LLM_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                Capital ($)
              </label>
              <input
                type="number"
                min={1}
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-ink px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
                Max position
              </label>
              <input
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                value={maxPositionPct}
                onChange={(e) => setMaxPositionPct(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-ink px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Max gross exposure
            </label>
            <input
              type="number"
              min={0.01}
              step={0.1}
              value={maxGrossExposure}
              onChange={(e) => setMaxGrossExposure(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-ink px-3 py-2 font-mono text-sm text-white outline-none focus:border-accent"
            />
          </div>

          <button
            onClick={runCycle}
            disabled={status === "loading"}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {status === "loading" ? "Running cycle…" : "Run cycle"}
          </button>
          {status === "loading" && (
            <p className="text-center text-xs text-gray-500">
              LLM analysts reason over each ticker one at a time — this can take a while.
            </p>
          )}
        </section>

        {/* Results panel */}
        <section className="min-h-[24rem] rounded-xl border border-border bg-panel p-5">
          {status === "idle" && (
            <EmptyState text="Build a fund on the left and run a cycle to see live signals here." />
          )}
          {status === "error" && (
            <div className="rounded-md border border-bear/40 bg-bear/10 px-4 py-3 text-sm text-bear">
              {error}
            </div>
          )}
          {status === "loading" && <EmptyState text="Running the fund's cycle…" pulse />}
          {status === "done" && record && (
            <Results record={record} expanded={expanded} onToggle={toggleExpanded} />
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ text, pulse }: { text: string; pulse?: boolean }) {
  return (
    <div className="flex h-full min-h-[20rem] items-center justify-center text-center">
      <p className={`max-w-xs text-sm text-gray-500 ${pulse ? "animate-pulse" : ""}`}>{text}</p>
    </div>
  );
}

function Results({
  record,
  expanded,
  onToggle,
}: {
  record: CycleRecord;
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="NAV" value={`$${record.nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="Cash" value={`$${record.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <Stat label="As of" value={record.as_of} />
        <Stat label="Orders" value={String(record.orders.length)} />
      </div>

      {record.skipped.length > 0 && (
        <p className="text-xs text-gray-500">
          Skipped: {record.skipped.map((s) => `${s.ticker} (${s.reason})`).join(", ")}
        </p>
      )}

      {record.strategies.map((sr) => (
        <div key={sr.name} className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-ink/60 px-4 py-2">
            <span className="text-sm font-medium text-white">{sr.name}</span>
            <span className="text-xs text-gray-500">{(sr.slice * 100).toFixed(0)}% of capital</span>
          </div>
          <div className="divide-y divide-border">
            {sr.signals.map((sig) => {
              const key = `${sr.name}-${sig.model_name}-${sig.ticker}`;
              const isOpen = expanded.has(key);
              const abstained = sig.metadata?.abstained === true;
              return (
                <div key={key} className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => sig.reasoning && onToggle(key)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-16 shrink-0 font-mono text-xs text-gray-400">{sig.ticker}</span>
                      <span className="truncate text-sm text-gray-200">{sig.model_name}</span>
                      {abstained && (
                        <span className="shrink-0 rounded-full bg-gray-700/40 px-1.5 py-0.5 text-[10px] uppercase text-gray-400">
                          abstained
                        </span>
                      )}
                    </div>
                    <ConvictionBar value={sig.value} />
                  </button>
                  {isOpen && sig.reasoning && (
                    <p className="mt-2 rounded-md bg-ink px-3 py-2 text-xs leading-relaxed text-gray-400">
                      {sig.reasoning}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {record.clamps.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-ink/60 px-4 py-2 text-sm font-medium text-white">
            Risk clamps
          </div>
          <div className="divide-y divide-border">
            {record.clamps.map((c, i) => (
              <div key={i} className="flex justify-between px-4 py-2 text-xs text-gray-400">
                <span>
                  {c.limit}
                  {c.ticker ? ` · ${c.ticker}` : ""}
                </span>
                <span className="font-mono">
                  {c.before.toFixed(3)} → {c.after.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {record.orders.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border bg-ink/60 px-4 py-2 text-sm font-medium text-white">
            Orders
          </div>
          <div className="divide-y divide-border">
            {record.orders.map((o, i) => (
              <div key={i} className="flex justify-between px-4 py-2 text-xs">
                <span className="font-mono text-gray-300">{o.ticker}</span>
                <span className={o.side === "buy" ? "text-bull" : "text-bear"}>
                  {o.side.toUpperCase()} {o.quantity}
                </span>
                <span className="font-mono text-gray-500">${o.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-ink/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 truncate font-mono text-sm text-white">{value}</div>
    </div>
  );
}
