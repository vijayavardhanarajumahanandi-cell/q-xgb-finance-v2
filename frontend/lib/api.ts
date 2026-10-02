export type Mode = "demo" | "live" | "model" | "manual";

export interface Candle {
  id?: number;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PredictionResult {
  id?: number | null;
  mode: Mode;
  data_mode?: Mode;
  timestamp: string;
  instrument: string;
  timeframe: string;
  price?: number | null;
  prediction: string;
  confidence: number;
  probabilities: Record<string, number>;
  models: Record<string, {
    prediction: string;
    probability: number;
    confidence: number;
    metadata?: Record<string, unknown>;
    weights?: Record<string, number> | null;
    meta_model?: boolean;
  }>;
  model_disagreement: number;
  risk: {
    score: number;
    volatility: number;
    prediction_uncertainty: number;
    model_disagreement: number;
    description: string;
  };
  features: Record<string, number>;
  indicators: Record<string, number>;
  shap: Array<{
    feature: string;
    value: number;
    shap_value: number;
    direction: string;
    importance: number;
  }>;
  warning?: string | null;
}

export interface HealthResult {
  status: string;
  service: string;
  version: string;
  mode: Mode;
  model_artifacts_loaded: boolean;
  xgboost_package: boolean;
  shap_package?: boolean;
  pennylane_package?: boolean;
  yahoo_data_package: boolean;
  database: boolean;
  database_path?: string;
  live_market_data?: boolean;
}

export interface PredictionHistoryRecord {
  id: number;
  created_at: string;
  timestamp: string;
  asset: string;
  timeframe: string;
  prediction: string;
  confidence: number;
  risk_score: number;
  xgb_probability: number;
  vqc_probability: number;
  hybrid_probability: number;
  mode: Mode;
  top_driver?: string | null;
}

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResult>("/health"),
  models: () => request<Record<string, unknown>>("/models"),
  quantum: () => request<Record<string, unknown>>("/quantum"),
  market: (instrument = "GC=F", timeframe = "1d", limit = 120) =>
    request<{ mode: Mode; instrument: string; timeframe: string; data: Candle[] }>(`/market?instrument=${encodeURIComponent(instrument)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`),
  marketTimestamps: (instrument = "GC=F", timeframe = "1d", limit = 60) =>
    request<{ mode: Mode; instrument: string; timeframe: string; timestamps: string[] }>(`/market/timestamps?instrument=${encodeURIComponent(instrument)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`),
  indicators: (instrument = "GC=F", timeframe = "1d", timestamp?: string) =>
    request<{ mode: Mode; instrument: string; timeframe: string; timestamp: string; values: Record<string, number>; features: Record<string, number> }>(`/indicators?instrument=${encodeURIComponent(instrument)}&timeframe=${encodeURIComponent(timeframe)}${timestamp ? `&timestamp=${encodeURIComponent(timestamp)}` : ""}`),
  performance: () => request<Record<string, unknown>>("/performance"),
  predict: (payload: { instrument: string; timeframe: string; timestamp?: string; features?: Record<string, number> }) =>
    request<PredictionResult>("/predict", { method: "POST", body: JSON.stringify(payload) }),
  explain: (payload: { instrument: string; timeframe: string; timestamp?: string; features?: Record<string, number> }) =>
    request<Record<string, unknown>>("/explain", { method: "POST", body: JSON.stringify(payload) }),
  predictionHistory: (limit = 200) =>
    request<{ data: PredictionHistoryRecord[] }>(`/predictions/history?limit=${limit}`),
  prediction: (id: number) => request<Record<string, unknown>>(`/predictions/${id}`),
  backtest: (payload: Record<string, unknown>) => request<Record<string, unknown>>("/backtest", { method: "POST", body: JSON.stringify(payload) }),
};

export function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function number(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

export function displayTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}
