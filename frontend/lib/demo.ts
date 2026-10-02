import type { Candle, PredictionResult } from "./api";

export function demoCandles(count = 120): Candle[] {
  const now = Date.now();
  let price = 2650;
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.sin(i / 7) * 14 + Math.sin(i / 19) * 7;
    const drift = i * 0.18;
    const close = price + wave + drift;
    const open = close - Math.sin(i * 1.7) * 4;
    const high = Math.max(open, close) + 5 + Math.abs(Math.cos(i)) * 4;
    const low = Math.min(open, close) - 5 - Math.abs(Math.sin(i)) * 4;
    out.push({
      timestamp: new Date(now - (count - i) * 86400000).toISOString(),
      open, high, low, close,
      volume: 100000 + Math.round(Math.abs(Math.sin(i / 3)) * 100000),
    });
    price = close;
  }
  return out;
}

export const demoPrediction: PredictionResult = {
  mode: "demo",
  timestamp: new Date().toISOString(),
  instrument: "GC=F",
  timeframe: "1d",
  prediction: "UP",
  confidence: 0.68,
  probabilities: { up: 0.68, down: 0.32 },
  models: {
    xgboost: { prediction: "UP", probability: 0.71, confidence: 0.71 },
    vqc: { prediction: "UP", probability: 0.60, confidence: 0.60, metadata: { qubits: 4, circuit_depth: 2, encoding: "AngleEmbedding" } },
    hybrid: { prediction: "UP", probability: 0.68, confidence: 0.68, weights: { xgboost: 0.58, vqc: 0.42 } },
  },
  model_disagreement: 0.11,
  risk: { score: 34, volatility: 12, prediction_uncertainty: 10, model_disagreement: 12, description: "Composite model-risk indicator. It is not a probability of loss." },
  features: { RSI: 62.4, MACD: 1.24, EMA_Ratio: 1.003, ATR_Percent: 0.012, Rolling_Volatility: 0.014, Daily_Return: 0.42 },
  indicators: { RSI: 62.4, MACD: 1.24, ATR_Percent: 0.012, Momentum: 0.82, Volume_Change: 4.1, Rolling_Volatility: 0.014, EMA_Ratio: 1.003, Daily_Return: 0.42 },
  shap: [
    { feature: "RSI", value: 62.4, shap_value: 0.31, direction: "positive", importance: 0.31 },
    { feature: "MACD", value: 1.24, shap_value: 0.26, direction: "positive", importance: 0.26 },
    { feature: "EMA_Ratio", value: 1.003, shap_value: 0.18, direction: "positive", importance: 0.18 },
    { feature: "ATR_Percent", value: 0.012, shap_value: -0.12, direction: "negative", importance: 0.12 },
    { feature: "Rolling_Volatility", value: 0.014, shap_value: -0.08, direction: "negative", importance: 0.08 },
  ],
};
