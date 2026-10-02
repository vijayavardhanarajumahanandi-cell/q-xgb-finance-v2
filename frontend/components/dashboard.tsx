"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Candle, type PredictionResult, number, percent } from "@/lib/api";
import { demoCandles, demoPrediction } from "@/lib/demo";
import { Card, DemoBadge, ErrorState, MetricCard, Progress, SectionTitle } from "@/components/ui";
import { ModelProbabilityBars, ProbabilityChart, ShapChart, TimeSeriesChart, MiniSparkline } from "@/components/charts";
import { Activity, BrainCircuit, Clock3, Gauge, ShieldAlert, Sparkles, Zap } from "lucide-react";

function modelLabel(name: string) { return name === "xgboost" ? "XGBoost" : name === "vqc" ? "VQC" : "Hybrid"; }

export function DashboardView() {
  const [prediction, setPrediction] = useState<PredictionResult>(demoPrediction);
  const [candles, setCandles] = useState<Candle[]>(demoCandles());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState("1d");

  useEffect(() => {
    Promise.all([api.market("GC=F", timeframe, 120), api.predict({ instrument: "GC=F", timeframe })])
      .then(([market, pred]) => { setCandles(market.data); setPrediction(pred); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [timeframe]);

  const latest = candles.at(-1);
  const previous = candles.at(-2);
  const priceChange = latest && previous ? latest.close - previous.close : 0;
  const changePct = previous ? priceChange / previous.close : 0;
  const modelRows = Object.entries(prediction.models).map(([key, model]) => ({ name: modelLabel(key), probability: model.probability }));

  return <div className="space-y-6">
    {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#66fcf1]">Market workspace</span><DemoBadge text={prediction.mode === "demo" ? "Demo Mode" : "API Mode"}/></div>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Gold Market Intelligence</h1>
        <p className="mt-2 text-sm text-slate-500">Model-based directional classification with transparent probability, explainability and risk context.</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-[#252b36] bg-[#151922] p-1"><button className={`rounded-lg px-3 py-1.5 text-xs ${timeframe === "1d" ? "bg-[#66fcf1] text-[#0b0c10]" : "text-slate-400"}`} onClick={() => setTimeframe("1d")}>1D</button><button className={`rounded-lg px-3 py-1.5 text-xs ${timeframe === "1h" ? "bg-[#66fcf1] text-[#0b0c10]" : "text-slate-400"}`} onClick={() => setTimeframe("1h")}>1H</button></div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Prediction" value={prediction.prediction} meta="Current model output" icon={<Gauge size={18}/>} />
      <MetricCard label="Confidence" value={percent(prediction.confidence)} meta="Distance from 50% boundary" trend={(prediction.confidence - .5) * 100} icon={<TargetIcon/>} />
      <MetricCard label="Model Risk" value={`${prediction.risk.score}/100`} meta="Composite uncertainty indicator" icon={<ShieldAlert size={18}/>} />
      <MetricCard label="Inference Latency" value={loading ? "—" : "128 ms"} meta="Illustrative / API-dependent" icon={<Clock3 size={18}/>} />
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.45fr_.9fr]">
      <Card className="overflow-hidden p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400"/><span className="text-xs font-medium text-slate-400">Gold / USD research instrument</span></div><div className="mt-2 flex items-end gap-4"><div className="mono text-3xl font-semibold">{latest ? `$${number(latest.close)}` : "—"}</div><div className={`mb-1 text-sm ${changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{changePct >= 0 ? "+" : ""}{(changePct*100).toFixed(2)}%</div></div></div>
          <div className="text-right text-xs text-slate-600">{latest ? new Date(latest.timestamp).toLocaleString() : "No timestamp"}</div>
        </div>
        <div className="mt-6"><TimeSeriesChart data={candles} /></div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between"><div><div className="text-xs uppercase tracking-widest text-slate-600">Model outlook</div><div className="mt-2 text-3xl font-semibold">{prediction.prediction}</div><div className="mt-1 text-sm text-slate-400">Confidence {percent(prediction.confidence)}</div></div><div className="rounded-xl border border-[#252b36] bg-[#0e1117] p-2 text-[#66fcf1]"><Sparkles size={20}/></div></div>
        <div className="mt-6"><ProbabilityChart up={prediction.probabilities.up ?? 0} down={prediction.probabilities.down ?? 0}/></div>
        <div className="mt-2 text-xs leading-5 text-slate-500">Confidence represents the model's position relative to the decision boundary; it is not a probability of profit or a guarantee.</div>
      </Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-5"><SectionTitle title="Model probability comparison" subtitle="Measured probability outputs; demo values are labeled when no model artifacts are connected."/><ModelProbabilityBars models={modelRows}/></Card>
      <Card className="p-5"><SectionTitle title="Model disagreement" subtitle="Absolute difference between XGBoost and VQC probability outputs."/><div className="mt-7 space-y-5"><DisagreementRow label="XGBoost" value={(prediction.models.xgboost?.probability ?? 0)*100}/><DisagreementRow label="VQC" value={(prediction.models.vqc?.probability ?? 0)*100}/><div className="border-t border-[#252b36] pt-5"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">Difference</span><span className="mono text-lg font-semibold">{(prediction.model_disagreement*100).toFixed(1)}%</span></div><Progress value={prediction.model_disagreement*100*4} tone={prediction.model_disagreement < .1 ? "green" : "amber"}/><p className="mt-2 text-xs text-slate-600">Higher disagreement means relatively higher model uncertainty; it is not a probability of loss.</p></div></div></Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <Card className="p-5"><SectionTitle title="Top feature contributions" subtitle="Feature contribution to model output; SHAP-style view is not a causal explanation."/><ShapChart rows={prediction.shap}/></Card>
      <Card className="p-5"><SectionTitle title="Model risk" subtitle="Composite indicator based on uncertainty and market conditions."/><div className="flex items-center gap-6"><div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#66fcf1 ${prediction.risk.score}%, #252b36 0)` }}><div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#151922]"><div className="text-center"><div className="mono text-2xl font-semibold">{prediction.risk.score}</div><div className="text-[10px] uppercase tracking-wider text-slate-600">/100</div></div></div></div><div className="min-w-0 flex-1 space-y-4"><RiskRow label="Volatility" value={prediction.risk.volatility}/><RiskRow label="Prediction uncertainty" value={prediction.risk.prediction_uncertainty}/><RiskRow label="Model disagreement" value={prediction.risk.model_disagreement}/></div></div><div className="mt-5 rounded-lg border border-[#252b36] bg-[#0e1117] p-3 text-xs leading-5 text-slate-500">{prediction.risk.description}</div></Card>
    </div>

    <Card className="p-5"><SectionTitle title="Technical indicators" subtitle="Indicators are descriptive inputs; they do not independently guarantee direction."/><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">{Object.entries(prediction.indicators).slice(0,8).map(([key,value]) => <div key={key} className="rounded-xl border border-[#252b36] bg-[#0e1117] p-4"><div className="flex items-center justify-between"><div className="text-xs text-slate-500">{key}</div><Activity size={14} className="text-slate-600"/></div><div className="mono mt-2 text-lg font-semibold">{Number(value).toFixed(key.includes("Return") ? 3 : 4)}</div><MiniSparkline values={[0, .2, .1, .35, .3, .48, .41, .55].map(v => Number(value) * (1 + v/10))}/></div>)}</div></Card>

    <Card className="grid-bg p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-semibold">Scientific transparency</div><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Q-XGB Finance presents probabilistic model outputs for research and educational use. The system does not claim guaranteed market performance or quantum advantage.</p></div><BrainCircuit className="hidden text-[#66fcf1] md:block" size={32}/></div></Card>
  </div>;
}

function DisagreementRow({ label, value }: { label: string; value: number }) { return <div><div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-400">{label}</span><span className="mono font-semibold">{value.toFixed(1)}%</span></div><Progress value={value} tone={label === "VQC" ? "amber" : "cyan"}/></div>; }
function RiskRow({ label, value }: { label: string; value: number }) { return <div><div className="mb-1 flex items-center justify-between text-[11px] text-slate-500"><span>{label}</span><span className="mono text-slate-300">{value.toFixed(1)}</span></div><Progress value={value} tone="cyan"/></div>; }
function TargetIcon() { return <TrendingIcon/>; }
function TrendingIcon() { return <TrendingUpIcon/>; }
function TrendingUpIcon() { return <Activity size={18}/>; }
