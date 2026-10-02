"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Info, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[.22em] text-[#66fcf1]">{eyebrow || "Q-XGB Finance"}</div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}</div>
    {action}
  </div>;
}

export function DemoBadge({ text = "Demo data" }: { text?: string }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-amber-300">{text}</span>;
}

export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="mb-4"><h2 className="text-sm font-semibold text-white">{title}</h2>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>;
}

export function MetricCard({ label, value, meta, trend, icon }: { label: string; value: string; meta?: string; trend?: number; icon?: React.ReactNode }) {
  const up = (trend ?? 0) >= 0;
  return <Card className="p-4">
    <div className="flex items-start justify-between"><div><p className="text-xs text-slate-500">{label}</p><div className="mono mt-2 text-2xl font-semibold tracking-tight">{value}</div></div>{icon && <div className="rounded-lg border border-[#252b36] bg-[#0e1117] p-2 text-[#66fcf1]">{icon}</div>}</div>
    <div className="mt-3 flex items-center gap-2 text-xs">{trend !== undefined && <span className={`inline-flex items-center gap-1 ${up ? "text-emerald-400" : "text-red-400"}`}>{up ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {Math.abs(trend).toFixed(1)}%</span>}{meta && <span className="text-slate-600">{meta}</span>}</div>
  </Card>;
}

export function Progress({ value, tone = "cyan" }: { value: number; tone?: "cyan" | "green" | "red" | "amber" }) {
  const color = { cyan: "bg-[#66fcf1]", green: "bg-emerald-400", red: "bg-red-400", amber: "bg-amber-400" }[tone];
  return <div className="h-2 overflow-hidden rounded-full bg-[#0e1117]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></div>;
}

export function LoadingState({ label = "Loading analysis..." }: { label?: string }) {
  return <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-[#252b36] bg-[#0e1117]/60"><div className="flex items-center gap-3 text-sm text-slate-500"><Loader2 className="animate-spin" size={18}/>{label}</div></div>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-[#252b36] bg-[#0e1117]/60 px-6 text-center"><div className="rounded-full border border-[#252b36] bg-[#151922] p-3 text-slate-500"><Info size={18}/></div><h3 className="mt-3 text-sm font-semibold">{title}</h3>{description && <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="rounded-xl border border-red-400/15 bg-red-400/5 p-4"><div className="text-sm font-semibold text-red-200">Unable to load this section</div><p className="mt-1 text-xs leading-5 text-red-100/60">{message}</p>{onRetry && <button onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-200 hover:bg-red-400/10"><RefreshCw size={13}/>Retry</button>}</div>;
}

export function Button({ children, href, onClick, variant = "primary", disabled = false }: { children: React.ReactNode; href?: string; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean }) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${variant === "primary" ? "bg-[#66fcf1] text-[#0b0c10] hover:bg-[#8efff8]" : variant === "danger" ? "border border-red-400/20 bg-red-400/5 text-red-200 hover:bg-red-400/10" : variant === "secondary" ? "border border-[#252b36] bg-[#151922] text-white hover:bg-[#1b202a]" : "text-slate-300 hover:bg-white/5"} ${disabled ? "pointer-events-none opacity-40" : ""}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button disabled={disabled} onClick={onClick} className={cls}>{children}</button>;
}

export function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-[#252b36] bg-[#0e1117] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-700 focus:border-[#66fcf1]/50"/></label>;
}

export function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[#252b36] bg-[#0e1117] px-3 py-2.5 text-sm text-white outline-none focus:border-[#66fcf1]/50">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
