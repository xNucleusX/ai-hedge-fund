// Mirrors the JSON shape of hedge_fund.pipeline.models.CycleRecord
// (pydantic model_dump_json — field names are unchanged, snake_case).

export interface Signal {
  model_name: string;
  ticker: string;
  date: string;
  value: number;
  reasoning: string | null;
  components: Record<string, number>;
  metadata: Record<string, unknown>;
}

export interface StrategyRecord {
  name: string;
  slice: number;
  signals: Signal[];
  convictions: Record<string, number>;
  weights: Record<string, number>;
}

export interface ClampEvent {
  limit: "max_position_pct" | "max_gross_exposure";
  ticker: string | null;
  before: number;
  after: number;
}

export interface TickerSkip {
  ticker: string;
  reason: string;
}

export interface Order {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
}

export interface Fill {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
}

export interface CycleRecord {
  fund: string;
  as_of: string;
  spec: unknown;
  universe: string[];
  marks: Record<string, number>;
  skipped: TickerSkip[];
  strategies: StrategyRecord[];
  target_weights: Record<string, number>;
  clamps: ClampEvent[];
  final_weights: Record<string, number>;
  equity_before: number;
  cash_before: number;
  orders: Order[];
  fills: Fill[];
  positions: Record<string, number>;
  cash: number;
  nav: number;
}

export interface RunRequest {
  tickers: string[];
  analysts: string[];
  capital: number;
  max_position_pct: number;
  max_gross_exposure: number;
  date?: string;
  model?: string;
}

export interface ApiError {
  error: string;
}
