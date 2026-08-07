export type AnalystKind = "llm" | "quant";

export interface AnalystInfo {
  id: string;
  name: string;
  kind: AnalystKind;
  blurb: string;
}

// Mirrors hedge_fund.signals.ALPHA_MODEL_REGISTRY — kept in sync by hand
// since the registry lives in the Python package this UI drives.
export const ANALYSTS: AnalystInfo[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    kind: "llm",
    blurb: "Durable moats, honest management, a fair price for a wonderful business.",
  },
  {
    id: "munger",
    name: "Charlie Munger",
    kind: "llm",
    blurb: "Wonderful businesses at fair prices; mental-models rigor.",
  },
  {
    id: "graham",
    name: "Ben Graham",
    kind: "llm",
    blurb: "Deep value, margin of safety, hidden gems.",
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    kind: "llm",
    blurb: "Invest in what you understand; growth at a reasonable price.",
  },
  {
    id: "druckenmiller",
    name: "Stanley Druckenmiller",
    kind: "llm",
    blurb: "Asymmetric bets, macro-aware, concentrated conviction.",
  },
  {
    id: "pead",
    name: "PEAD",
    kind: "quant",
    blurb: "Post-earnings-announcement drift — pure quant, no LLM call.",
  },
];

// Anthropic-only: the deployed dashboard bundles langchain-anthropic alone
// to keep the Vercel Python function under the platform's size limit (see
// web/requirements.txt). The `aihf` CLI supports the full provider
// registry (OpenAI, xAI, DeepSeek, Google, Kimi) if you run it locally.
export const LLM_MODELS = [
  { id: "claude-sonnet-5", name: "Sonnet 5", provider: "Anthropic" },
  { id: "claude-opus-5", name: "Opus 5", provider: "Anthropic" },
  { id: "claude-fable-5", name: "Fable 5", provider: "Anthropic" },
];
