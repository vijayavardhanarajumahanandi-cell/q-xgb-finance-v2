"use client";

import { useEffect, useState } from "react";
import { api, number, percent, type Candle } from "@/lib/api";
import { Card, DemoBadge, EmptyState, ErrorState, Field, PageHeader, SelectField, SectionTitle, MetricCard, Button } from "@/components/ui";
import { DrawdownChart, EquityChart, MetricBars, ShapChart, TimeSeriesChart } from "@/components/charts";
import { BrainCircuit, Database, FileText, Gauge, LineChart, ShieldAlert, Sparkles, Zap } from "lucide-react";

export function MarketPage() {
  const [candles, setCandles] = useState<Candle[]>([]);
  useEffect(() => { api.market("GC=F", "1d", 180).then(r => setCandles(r.data)).catch(() => setCandles([])); }, []);
  const latest = candles.at(-1); const prev = candles.at(-2); const change = latest && prev ? latest.close/prev.close-1 : 0;
  return <div className="space-y-6"><PageHeader eyebrow="Market" title="Market Overview" description="Gold market context with price history, indicators and current model outlook." action={<DemoBadge/>}/><div className="grid gap-4 md:grid-cols-4"><MetricCard label="Instrument" value="GC=F" meta="Gold futures / project research symbol" icon={<Database size={18}/>}/><MetricCard label="Last Price" value={latest ? `$${number(latest.close)}` : "—"} meta="Data-source dependent" icon={<Gauge size={18}/>}/><MetricCard label="Change" value={`${change >= 0 ? "+" : ""}${(change*100).toFixed(2)}%`} meta="Previous bar" trend={change*100} icon={<LineChart size={18}/>}/><MetricCard label="Status" value="Research" meta="Not financial advice" icon={<ShieldAlert size={18}/>}/></div><Card className="p-5"><SectionTitle title="Gold price" subtitle="Historical series; demo fallback is clearly marked by the API."/><TimeSeriesChart data={candles}/></Card></div>;
}

export function ModelsPage() {
  const [perf, setPerf] = useState<any>(null);
  useEffect(() => { api.performance().then(setPerf).catch(() => setPerf(null)); }, []);
  return <div className="space-y-6"><PageHeader eyebrow="Intelligence" title="Model Comparison" description="Transparent comparison of the baseline, XGBoost, VQC and hybrid outputs." action={<DemoBadge text={perf?.mode === "demo" ? "Illustrative metrics" : "Measured metrics"}/>}/><Card className="p-5"><SectionTitle title="Performance profile" subtitle={perf?.split || "Chronological evaluation"}/>{perf ? <><MetricBars models={perf.models}/><div className="mt-6 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-[#252b36] text-slate-600"><tr><th className="py-3">Model</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>ROC-AUC</th></tr></thead><tbody>{perf.models.map((m:any)=><tr key={m.name} className="border-b border-[#252b36]/70"><td className="py-3 font-medium text-slate-200">{m.name}</td><td className="mono">{percent(m.accuracy)}</td><td className="mono">{percent(m.precision)}</td><td className="mono">{percent(m.recall)}</td><td className="mono">{percent(m.f1)}</td><td className="mono">{percent(m.roc_auc)}</td></tr>)}</tbody></table></div></> : <EmptyState title="Performance endpoint unavailable" description="The dashboard remains usable in Demo Mode."/>}</Card></div>;
}

export function QuantumPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.quantum().then(setData).catch(() => setData(null)); }, []);
  return <div className="space-y-6"><PageHeader eyebrow="Intelligence" title="Quantum Model" description="Backend-driven VQC configuration and research context." action={<DemoBadge text="Artifact-driven configuration"/>}/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><MetricCard label="Qubits" value={data?.qubits ? String(data.qubits) : "—"} meta="Read from backend artifact" icon={<Zap size={18}/>}/><MetricCard label="Circuit Depth" value={data?.circuit_depth ? String(data.circuit_depth) : "—"} meta="Backend metadata" icon={<BrainCircuit size={18}/>}/><MetricCard label="Encoding" value={data?.encoding || "Unavailable"} meta="Backend metadata" icon={<Sparkles size={18}/>}/><MetricCard label="Availability" value={data?.available ? "Available" : "Demo"} meta={data?.message || "No QML artifact"} icon={<Gauge size={18}/>}/></div><Card className="p-6"><div className="grid-bg rounded-xl border border-[#252b36] p-6"><div className="flex flex-wrap items-center justify-center gap-3 text-sm"><Box text="Feature scaling"/><Arrow/><Box text="Angle encoding"/><Arrow/><Box text={`${data?.qubits || "Q"}-qubit circuit`}/><Arrow/><Box text="Measurement"/><Arrow/><Box text="Probability"/></div></div><div className="mt-5 rounded-lg border border-amber-400/10 bg-amber-400/5 p-4 text-xs leading-5 text-amber-200/80">The application does not claim quantum advantage. The page shows the configuration and output exposed by the backend artifact.</div></Card></div>;
}
function Box({text}:{text:string}){return <div className="rounded-lg border border-[#252b36] bg-[#151922] px-4 py-3 text-slate-300">{text}</div>}
function Arrow(){return <span className="text-[#66fcf1]">→</span>}

export function ExplainabilityPage() {
  const [prediction, setPrediction] = useState<any>(null);
  useEffect(() => { api.predict({ instrument: "GC=F", timeframe: "1d" }).then(setPrediction).catch(() => setPrediction(null)); }, []);
  return <div className="space-y-6"><PageHeader eyebrow="Explainability" title="Why did the model make this prediction?" description="Feature contributions help explain the model output without implying causality." action={<DemoBadge/>}/>{prediction ? <><Card className="p-5"><div className="flex items-center gap-3"><Sparkles className="text-[#66fcf1]" size={20}/><div><div className="text-sm font-semibold">{prediction.prediction} · {percent(prediction.confidence)} confidence</div><div className="text-xs text-slate-500">{prediction.mode === "demo" ? "Illustrative Demo Mode" : "Backend model result"}</div></div></div></Card><Card className="p-5"><SectionTitle title="Feature contribution chart"/><ShapChart rows={prediction.shap}/></Card><Card className="overflow-hidden"><div className="border-b border-[#252b36] p-5"><SectionTitle title="Feature contribution table" subtitle="Current value + SHAP-style contribution."/></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-[#0e1117] text-slate-600"><tr><th className="p-3">Feature</th><th>Current value</th><th>Contribution</th><th>Direction</th><th>Importance</th></tr></thead><tbody>{prediction.shap.map((r:any)=><tr key={r.feature} className="border-t border-[#252b36]"><td className="p-3 font-medium text-slate-200">{r.feature}</td><td className="mono">{r.value}</td><td className="mono">{r.shap_value.toFixed(3)}</td><td className={r.direction === "positive" ? "text-emerald-400" : "text-red-400"}>{r.direction}</td><td className="mono">{r.importance.toFixed(3)}</td></tr>)}</tbody></table></div></Card></> : <EmptyState title="No explanation available" description="Connect the prediction service to inspect model contributions."/>}</div>;
}

export function ChartsPage() {
  const [candles, setCandles] = useState<Candle[]>([]);
  useEffect(() => { api.market("GC=F", "1d", 180).then(r=>setCandles(r.data)).catch(()=>{}); }, []);
  return <div className="space-y-6"><PageHeader eyebrow="Market" title="Charts & Indicators" description="Interactive market history with a clean research-dashboard presentation."/><Card className="p-5"><div className="flex items-center justify-between"><SectionTitle title="Price workspace" subtitle="Use the dedicated backend for actual live data when connected."/><div className="flex gap-2"><DemoBadge/><Button variant="secondary">Reset</Button></div></div><TimeSeriesChart data={candles}/></Card><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{["RSI","MACD","ATR","Rolling Volatility","Momentum","Volume","EMA Difference","Returns"].map((x,i)=><Card key={x} className="p-4"><div className="text-xs text-slate-500">{x}</div><div className="mono mt-2 text-xl font-semibold">{[62.4,1.24,.012,.014,.82,4.1,1.003,.42][i]}</div><div className="mt-2 text-[11px] text-slate-600">Descriptive indicator · not a guarantee</div></Card>)}</div></div>;
}

export function PerformancePage() { return <ModelsPage/>; }

export function HistoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api.predictionHistory(200);
      setRows(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load prediction history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = rows.filter(r => `${r.asset} ${r.prediction} ${r.top_driver || ""}`.toLowerCase().includes(q.toLowerCase()));

  return <div className="space-y-6">
    <PageHeader eyebrow="Analytics" title="Prediction History" description="Predictions saved by the FastAPI backend in the Q-XGB SQLite database." action={<DemoBadge text="SQLite server-side"/>}/>
    {error && <ErrorState message={error} />}
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Field label="" value={q} onChange={setQ} placeholder="Search history..."/>
        <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
      </div>
      {loading ? <div className="py-12 text-center text-xs text-slate-500">Loading SQLite prediction history…</div> : filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-xs"><thead className="border-b border-[#252b36] text-left text-slate-600"><tr><th className="p-3">Created</th><th>Selected Bar</th><th>Instrument</th><th>TF</th><th>Prediction</th><th>Confidence</th><th>XGB</th><th>VQC</th><th>Hybrid</th><th>Risk</th><th>Top Driver</th><th>Mode</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-b border-[#252b36]/70"><td className="p-3">{new Date(r.created_at).toLocaleString()}</td><td>{new Date(r.timestamp).toLocaleString()}</td><td>{r.asset}</td><td>{r.timeframe}</td><td className="font-semibold">{r.prediction}</td><td className="mono">{percent(r.confidence)}</td><td className="mono">{percent(r.xgb_probability)}</td><td className="mono">{percent(r.vqc_probability)}</td><td className="mono">{percent(r.hybrid_probability)}</td><td className="mono">{r.risk_score}/100</td><td>{r.top_driver || "—"}</td><td>{r.mode}</td></tr>)}</tbody></table></div> : <EmptyState title="No database predictions yet" description="Run a prediction from the Prediction Workspace. The selected market bar and model output will be stored in SQLite automatically."/>}
    </Card>
  </div>;
}

export function BacktestPage() {
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(false);
  async function run(){setLoading(true); try{setData(await api.backtest({model:"hybrid",instrument:"GC=F",timeframe:"1d",initial_capital:10000}));}finally{setLoading(false)}}
  return <div className="space-y-6"><PageHeader eyebrow="Analytics" title="Backtesting" description="Historical simulation workspace. Results are indicative and not a promise of future performance." action={<DemoBadge/>}/><Card className="p-5"><div className="grid gap-4 md:grid-cols-4"><Field label="Start Date" value="2018-01-01" onChange={()=>{}} type="date"/><Field label="End Date" value={new Date().toISOString().slice(0,10)} onChange={()=>{}} type="date"/><Field label="Initial Capital" value="10000" onChange={()=>{}}/><SelectField label="Model" value="Hybrid" onChange={()=>{}} options={["Hybrid","XGBoost","VQC"]}/></div><div className="mt-4"><Button onClick={run} disabled={loading}>{loading ? "Running…" : "Run Backtest"}</Button></div></Card>{data && <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><MetricCard label="Total Return" value={percent(data.total_return)} meta="Historical simulation" icon={<LineChart size={18}/>}/><MetricCard label="Max Drawdown" value={percent(data.maximum_drawdown)} icon={<ShieldAlert size={18}/>}/><MetricCard label="Trades" value={String(data.number_of_trades)} icon={<Gauge size={18}/>}/><MetricCard label="Win Rate" value={percent(data.win_rate)} icon={<Sparkles size={18}/>}/><MetricCard label="Profit Factor" value={String(data.profit_factor)} icon={<Zap size={18}/>}/></div><Card className="p-5"><SectionTitle title="Equity curve"/><EquityChart data={data.equity_curve}/></Card><Card className="p-5"><SectionTitle title="Drawdown"/><DrawdownChart data={data.drawdown_curve}/></Card><div className="rounded-xl border border-amber-400/10 bg-amber-400/5 p-4 text-xs leading-5 text-amber-200/80">{data.warning}</div></>}</div>;
}

export function WatchlistPage(){const [items,setItems]=useState<any[]>([{symbol:"GC=F",name:"Gold Futures",price:"—",change:"—",prediction:"UP",confidence:"68%"}]); return <div className="space-y-6"><PageHeader eyebrow="Market" title="Watchlist" description="The MVP keeps the interface extensible without pretending additional live assets are connected."/><Card className="p-5"><div className="space-y-3">{items.map(i=><div key={i.symbol} className="flex flex-col gap-3 rounded-xl border border-[#252b36] bg-[#0e1117] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{i.symbol}</div><div className="text-xs text-slate-600">{i.name}</div></div><div className="grid grid-cols-3 gap-6 text-right"><div><div className="text-xs text-slate-600">Price</div><div className="mono text-sm">{i.price}</div></div><div><div className="text-xs text-slate-600">Prediction</div><div className="text-sm text-emerald-400">{i.prediction}</div></div><div><div className="text-xs text-slate-600">Confidence</div><div className="mono text-sm">{i.confidence}</div></div></div></div>)}</div></Card></div>}

export function AlertsPage(){const [enabled,setEnabled]=useState(false); return <div className="space-y-6"><PageHeader eyebrow="System" title="Alerts" description="Alert configurations are stored locally in this browser; notification delivery is not connected in the no-database MVP."/><Card className="p-5"><div className="flex items-center justify-between"><div><div className="text-sm font-semibold">Confidence threshold</div><div className="mt-1 text-xs text-slate-500">Notify when GC=F model confidence exceeds 70%.</div></div><button onClick={()=>setEnabled(!enabled)} className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-[#66fcf1]" : "bg-[#252b36]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full transition ${enabled ? "left-6 bg-[#0b0c10]" : "left-1 bg-slate-500"}`}/></button></div><div className="mt-5 rounded-lg border border-[#252b36] bg-[#0e1117] p-3 text-xs text-slate-500">Delivery infrastructure: <span className="text-amber-300">Coming Soon</span></div></Card></div>}

export function ReportsPage(){return <div className="space-y-6"><PageHeader eyebrow="Analytics" title="Reports" description="Generate research summaries from the current application state."/><div className="grid gap-4 md:grid-cols-2"><ReportCard title="Prediction Report" body="Prediction, confidence, model probabilities, feature contributions and indicator snapshot."/><ReportCard title="Model Performance Report" body="Accuracy, precision, recall, F1, ROC-AUC, training and inference metadata."/></div></div>}
function ReportCard({title,body}:{title:string;body:string}){return <Card className="p-5"><div className="flex items-center gap-3"><div className="rounded-lg border border-[#252b36] bg-[#0e1117] p-2 text-[#66fcf1]"><FileText size={18}/></div><div><div className="text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{body}</div></div></div><div className="mt-5 flex gap-2"><Button>Generate Report</Button><Button variant="secondary" disabled>Download PDF</Button></div><div className="mt-3 text-[11px] text-slate-600">PDF generation is intentionally disabled until a backend/report renderer is connected.</div></Card>}

export function ProfilePage(){return <div className="space-y-6"><PageHeader eyebrow="Account" title="Profile" description="Local demo profile. No database-backed user account is created."/><Card className="p-5"><div className="grid gap-4 md:grid-cols-2"><Field label="Full name" value="Q-XGB Researcher" onChange={()=>{}}/><Field label="Email" value="demo@q-xgb.local" onChange={()=>{}}/><SelectField label="Default instrument" value="GC=F" onChange={()=>{}} options={["GC=F","XAUUSD"]}/><SelectField label="Default timeframe" value="1d" onChange={()=>{}} options={["1d","1h","15m"]}/></div></Card></div>}

export function SettingsPage(){return <div className="space-y-6"><PageHeader eyebrow="System" title="Settings" description="Application preferences are stored in browser local storage because this deployment intentionally has no database."/><div className="grid gap-4 md:grid-cols-2"><Card className="p-5"><SectionTitle title="General"/><div className="space-y-4"><SelectField label="Language" value="English" onChange={()=>{}} options={["English"]}/><SelectField label="Theme" value="Dark" onChange={()=>{}} options={["Dark","Light"]}/></div></Card><Card className="p-5"><SectionTitle title="Data"/><div className="space-y-3 text-xs text-slate-500"><div className="rounded-lg border border-[#252b36] bg-[#0e1117] p-3">Prediction history: browser-local</div><div className="rounded-lg border border-[#252b36] bg-[#0e1117] p-3">Server database: disabled</div><Button variant="secondary" onClick={()=>{localStorage.clear();window.location.reload()}}>Clear browser data</Button></div></Card></div></div>}

export function HelpPage(){return <div className="space-y-6"><PageHeader eyebrow="Documentation" title="Help & Documentation" description="Understand the models, metrics, risk signals and limitations."/><div className="grid gap-4 md:grid-cols-2">{["What is Q-XGB Finance?","How predictions work","What is XGBoost?","What is VQC?","What is the Hybrid Model?","What is SHAP?","What does confidence mean?","How are models evaluated?","How to interpret indicators","Backtesting","Limitations","Risk disclaimer"].map((title,i)=><Card key={title} className="p-5"><div className="text-sm font-semibold">{title}</div><p className="mt-2 text-xs leading-5 text-slate-500">{i===0?"A hybrid quantum-classical research platform that presents model-based market-direction analysis with transparent evaluation and explainability.":i===5?"SHAP-style feature contributions describe how features contribute to a model output; they should not be interpreted as causal market explanations.":"This section is designed to document the Q-XGB workflow without overstating what the current backend supports."}</p></Card>)}</div></div>}
