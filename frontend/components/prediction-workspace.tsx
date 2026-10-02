"use client";

import { useEffect, useMemo, useState } from "react";
import { api, displayTimestamp, type HealthResult, type PredictionResult } from "@/lib/api";
import { Button, Card, DemoBadge, EmptyState, ErrorState, PageHeader, Progress, SectionTitle, SelectField } from "@/components/ui";
import { ModelProbabilityBars, ProbabilityChart, ShapChart } from "@/components/charts";
import { Loader2, Play, Database, RefreshCw } from "lucide-react";

export function PredictionWorkspace({ detailId }: { detailId?: string }) {
  const [instrument, setInstrument] = useState("GC=F");
  const [timeframe, setTimeframe] = useState("1d");
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState("");
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBars, setLoadingBars] = useState(false);
  const [error, setError] = useState("");

  async function loadBars(symbol = instrument, tf = timeframe) {
    setLoadingBars(true);
    setError("");
    try {
      const [bars, healthResult] = await Promise.all([
        api.marketTimestamps(symbol, tf, 80),
        api.health(),
      ]);
      setHealth(healthResult);
      setTimestamps(bars.timestamps);
      if (bars.timestamps.length && !bars.timestamps.includes(timestamp)) {
        setTimestamp(bars.timestamps[bars.timestamps.length - 1]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load backend market data.");
    } finally {
      setLoadingBars(false);
    }
  }

  useEffect(() => {
    void loadBars();
    // Only instrument/timeframe should trigger a data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, timeframe]);

  useEffect(() => {
    if (!detailId) return;
    const id = Number(detailId);
    if (!Number.isInteger(id)) return;
    api.prediction(id)
      .then((record) => {
        const shap = Array.isArray(record.shap) ? record.shap : [];
        const xgb = Number(record.xgb_probability ?? 0);
        const vqc = Number(record.vqc_probability ?? 0);
        const hybrid = Number(record.hybrid_probability ?? 0);
        const mapped: PredictionResult = {
          id,
          mode: String(record.mode ?? "demo") as PredictionResult["mode"],
          timestamp: String(record.timestamp),
          instrument: String(record.asset),
          timeframe: String(record.timeframe),
          price: record.price == null ? null : Number(record.price),
          prediction: String(record.prediction),
          confidence: Number(record.confidence ?? 0),
          probabilities: { up: hybrid, down: 1 - hybrid },
          models: {
            xgboost: { prediction: xgb >= 0.5 ? "UP" : "DOWN", probability: xgb, confidence: Math.abs(xgb - 0.5) * 2 },
            vqc: { prediction: vqc >= 0.5 ? "UP" : "DOWN", probability: vqc, confidence: Math.abs(vqc - 0.5) * 2 },
            hybrid: { prediction: String(record.prediction), probability: hybrid, confidence: Number(record.confidence ?? 0) },
          },
          model_disagreement: Math.abs(xgb - vqc),
          risk: { score: Number(record.risk_score ?? 0), volatility: 0, prediction_uncertainty: Number(record.confidence ?? 0), model_disagreement: Math.abs(xgb - vqc), description: "Composite model-risk indicator. It is not a probability of loss." },
          features: {},
          indicators: {},
          shap,
        };
        setInstrument(mapped.instrument);
        setTimeframe(mapped.timeframe);
        setTimestamp(mapped.timestamp);
        setPrediction(mapped);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Prediction not found."));
  }, [detailId]);

  const selectedLabel = useMemo(() => timestamp ? displayTimestamp(timestamp) : "No market bar selected", [timestamp]);

  async function run() {
    if (!timestamp) {
      setError("Select an available historical market bar before running a prediction.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.predict({ instrument, timeframe, timestamp });
      setPrediction(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction API unavailable.");
    } finally {
      setLoading(false);
    }
  }

  const modelModeLabel = health?.model_artifacts_loaded ? "Backend model" : "Backend demo model";
  const databaseLabel = health?.database ? "SQLite connected" : "Database unavailable";

  return <div className="space-y-6">
    <PageHeader
      eyebrow="Market intelligence"
      title={detailId ? "Prediction Detail" : "Prediction Workspace"}
      description="Select an available market bar, run the backend inference pipeline, then inspect probabilities, explanations, and model disagreement."
      action={<div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#252b36] bg-[#151922] px-3 py-1.5 text-[10px] uppercase tracking-[.14em] text-slate-400"><Database size={12} className={health?.database ? "text-emerald-400" : "text-red-400"}/>{databaseLabel}</div>
        <DemoBadge text={health?.model_artifacts_loaded ? "Model API" : "Demo model API"}/>
      </div>}
    />

    {error && <ErrorState message={error} />}

    <Card className="p-5">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1.8fr_auto] md:items-end">
        <SelectField label="Instrument" value={instrument} onChange={setInstrument} options={["GC=F", "XAUUSD"]}/>
        <SelectField label="Timeframe" value={timeframe} onChange={setTimeframe} options={["1d", "1h", "15m"]}/>
        <SelectField
          label="Available market bar"
          value={timestamp}
          onChange={setTimestamp}
          options={timestamps.length ? timestamps : [""]}
        />
        <Button variant="secondary" onClick={() => void loadBars()} disabled={loadingBars}>
          {loadingBars ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>} Refresh
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
        <span>Selected: <span className="text-slate-400">{selectedLabel}</span></span>
        <span>{modelModeLabel} · predictions are saved server-side in SQLite</span>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={run} disabled={loading || !timestamp}>
          {loading ? <><Loader2 size={16} className="animate-spin"/>Running</> : <><Play size={16}/>Run Prediction</>}
        </Button>
      </div>
    </Card>

    {prediction && <>
      {prediction.warning && <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 p-4 text-xs leading-5 text-amber-200/80">{prediction.warning}</div>}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <DemoBadge text={prediction.mode === "demo" ? "Backend demo output" : "Backend model output"}/>
              <div className="mt-4 text-xs uppercase tracking-[.2em] text-slate-600">Final prediction</div>
              <div className="mt-2 text-4xl font-semibold">{prediction.prediction}</div>
              <p className="mt-2 text-sm text-slate-500">Confidence {Math.round(prediction.confidence * 100)}%</p>
              {prediction.price != null && <p className="mt-1 text-xs text-slate-600">Selected close: {prediction.price.toFixed(2)} · {displayTimestamp(prediction.timestamp)}</p>}
            </div>
          </div>
          <div className="mt-7"><ProbabilityChart up={prediction.probabilities.up ?? 0} down={prediction.probabilities.down ?? 0}/></div>
        </Card>

        <Card className="p-6">
          <SectionTitle title="Risk context" subtitle="Composite uncertainty indicator."/>
          <div className="text-5xl font-semibold mono">{prediction.risk.score}<span className="text-lg text-slate-600">/100</span></div>
          <div className="mt-5 space-y-4">
            <RiskBar label="Volatility" value={prediction.risk.volatility}/>
            <RiskBar label="Prediction uncertainty" value={prediction.risk.prediction_uncertainty}/>
            <RiskBar label="Model disagreement" value={prediction.risk.model_disagreement}/>
          </div>
        </Card>
      </div>

      <Card className="p-5"><SectionTitle title="Three-model comparison" subtitle="The hybrid output combines the probability streams; no automatic model ranking is performed."/><ModelProbabilityBars models={Object.entries(prediction.models).map(([name, model]) => ({ name: name.toUpperCase(), probability: model.probability }))}/></Card>
      <Card className="p-5"><SectionTitle title="SHAP / feature contribution" subtitle="Contribution to model output, not causality."/><ShapChart rows={prediction.shap}/></Card>
    </>}

    {!prediction && !loading && <Card className="p-10 text-center">
      <EmptyState title="Ready to run" description="Choose an available historical bar, then execute the backend prediction pipeline. The selected timestamp is used to calculate its own features." />
    </Card>}
  </div>;
}

function RiskBar({ label, value }: { label: string; value: number }) {
  return <div><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{label}</span><span className="mono">{value.toFixed(1)}</span></div><Progress value={value} tone="cyan"/></div>;
}
