"use client";

import { ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import type { Candle } from "@/lib/api";

const tooltipStyle = { background: "#151922", border: "1px solid #252b36", borderRadius: 10, color: "#fff" };

export function MiniSparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  const data = values.map((value, i) => ({ i, value }));
  return <div className="h-10 w-28"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><Line type="monotone" dataKey="value" stroke={positive ? "#66fcf1" : "#ff5d73"} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>;
}

export function ProbabilityChart({ up, down }: { up: number; down: number }) {
  const data = [{ name: "UP", value: up * 100 }, { name: "DOWN", value: down * 100 }];
  return <div className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid horizontal={false} stroke="#252b36"/><XAxis type="number" domain={[0,100]} tick={{ fill: "#667085", fontSize: 11 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={44} tick={{ fill: "#9aa4b5", fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(1)}%`, "Probability"]}/><Bar dataKey="value" radius={[0, 5, 5, 0]}>{data.map((d) => <Cell key={d.name} fill={d.name === "UP" ? "#44d19d" : "#ff5d73"}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}

export function ModelProbabilityBars({ models }: { models: Array<{ name: string; probability: number }> }) {
  const data = models.map((m) => ({ name: m.name, probability: m.probability * 100 }));
  return <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ left: 0, right: 16, bottom: 8 }}><CartesianGrid vertical={false} stroke="#252b36"/><XAxis dataKey="name" tick={{ fill: "#9aa4b5", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{ fill: "#667085", fontSize: 11 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(1)}%`, "Probability"]}/><Bar dataKey="probability" fill="#66fcf1" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>;
}

export function TimeSeriesChart({ data, dataKey = "close", height = 300, label = "Price" }: { data: Candle[]; dataKey?: keyof Candle; height?: number; label?: string }) {
  const prepared = data.map((d) => ({ ...d, label: new Date(d.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  return <div style={{ height }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={prepared} margin={{ left: 0, right: 10, top: 8, bottom: 0 }}><defs><linearGradient id="fillCyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#66fcf1" stopOpacity={0.22}/><stop offset="100%" stopColor="#66fcf1" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#252b36" vertical={false}/><XAxis dataKey="label" tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis domain={["dataMin - 20", "dataMax + 20"]} tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false} width={54}/><Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#94a3b8" }} formatter={(value) => [Number(value).toFixed(2), label]}/><Area type="monotone" dataKey={dataKey as string} stroke="#66fcf1" fill="url(#fillCyan)" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer></div>;
}

export function EquityChart({ data }: { data: Array<{ timestamp: string; equity: number }> }) {
  const prepared = data.map((d) => ({ ...d, label: new Date(d.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={prepared}><CartesianGrid stroke="#252b36" vertical={false}/><XAxis dataKey="label" tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toFixed(2), "Equity"]}/><Line type="monotone" dataKey="equity" stroke="#66fcf1" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div>;
}

export function DrawdownChart({ data }: { data: Array<{ timestamp: string; drawdown: number }> }) {
  const prepared = data.map((d) => ({ ...d, label: new Date(d.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  return <div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={prepared}><CartesianGrid stroke="#252b36" vertical={false}/><XAxis dataKey="label" tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tickFormatter={(v) => `${(v*100).toFixed(0)}%`} tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false}/><ReferenceLine y={0} stroke="#3b4351"/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${(Number(value)*100).toFixed(2)}%`, "Drawdown"]}/><Area type="monotone" dataKey="drawdown" stroke="#ff5d73" fill="#ff5d73" fillOpacity={0.08} strokeWidth={2}/></AreaChart></ResponsiveContainer></div>;
}

export function ShapChart({ rows }: { rows: Array<{ feature: string; shap_value: number }> }) {
  const data = [...rows].sort((a,b) => Math.abs(b.shap_value)-Math.abs(a.shap_value)).slice(0, 8).map((r) => ({ ...r, impact: r.shap_value }));
  return <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 26, right: 18 }}><CartesianGrid horizontal={false} stroke="#252b36"/><XAxis type="number" tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis dataKey="feature" type="category" width={92} tick={{ fill: "#9aa4b5", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value).toFixed(3), "Contribution"]}/><ReferenceLine x={0} stroke="#667085"/><Bar dataKey="impact" radius={[4,4,4,4]}>{data.map((r) => <Cell key={r.feature} fill={r.impact >= 0 ? "#44d19d" : "#ff5d73"}/>)}</Bar></BarChart></ResponsiveContainer></div>;
}

export function MetricBars({ models }: { models: Array<Record<string, any>> }) {
  const data = models.map((m) => ({ name: m.name, accuracy: m.accuracy * 100, f1: m.f1 * 100, auc: m.roc_auc * 100 }));
  return <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid vertical={false} stroke="#252b36"/><XAxis dataKey="name" tick={{ fill: "#9aa4b5", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#687385", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(1)}%`]}/><Bar dataKey="accuracy" fill="#66fcf1" radius={[4,4,0,0]}/><Bar dataKey="f1" fill="#8a2be2" radius={[4,4,0,0]}/><Bar dataKey="auc" fill="#44d19d" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>;
}
