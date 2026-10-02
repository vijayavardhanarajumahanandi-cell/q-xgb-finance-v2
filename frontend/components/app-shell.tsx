"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, BarChart3, Bell, BookOpen, BrainCircuit, CandlestickChart,
  ChevronLeft, ChevronRight, CircleUserRound, Gauge, HelpCircle, History, LineChart,
  LogOut, Menu, Moon, PanelLeft, Settings, ShieldAlert, SlidersHorizontal, Sparkles,
  Target, TrendingUp, UserRound, X, Zap, Search
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { readLocal, writeLocal } from "@/lib/storage";

const iconMap: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Gauge, Activity, TrendingUp, CandlestickChart, Target, BrainCircuit, Sparkles, Zap,
  LineChart, BarChart3, History, ShieldAlert, Bell, BookOpen, Settings, UserRound,
};

const sections = [
  { name: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "Gauge" }] },
  { name: "Market", items: [
    { href: "/market", label: "Market Overview", icon: "Activity" },
    { href: "/predictions", label: "Predictions", icon: "Target" },
    { href: "/charts", label: "Charts & Indicators", icon: "CandlestickChart" },
    { href: "/watchlist", label: "Watchlist", icon: "TrendingUp" },
  ]},
  { name: "Intelligence", items: [
    { href: "/models", label: "Model Comparison", icon: "BrainCircuit" },
    { href: "/explainability", label: "Explainability", icon: "Sparkles" },
    { href: "/quantum", label: "Quantum Model", icon: "Zap" },
  ]},
  { name: "Analytics", items: [
    { href: "/backtesting", label: "Backtesting", icon: "LineChart" },
    { href: "/performance", label: "Performance", icon: "BarChart3" },
    { href: "/history", label: "Prediction History", icon: "History" },
    { href: "/reports", label: "Reports", icon: "BookOpen" },
  ]},
  { name: "System", items: [
    { href: "/alerts", label: "Alerts", icon: "ShieldAlert" },
    { href: "/settings", label: "Settings", icon: "Settings" },
    { href: "/help", label: "Help & Documentation", icon: "HelpCircle" },
  ]},
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [demo, setDemo] = useState(true);

  useEffect(() => {
    setDemo(readLocal("demo-mode", false));
    setCollapsed(readLocal("sidebar-collapsed", false));
  }, []);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return sections.flatMap((section) => section.items.filter((i) => i.label.toLowerCase().includes(q)).map((i) => i));
  }, [search]);

  function toggleCollapsed() {
    const value = !collapsed;
    setCollapsed(value);
    writeLocal("sidebar-collapsed", value);
  }

  function logout() {
    writeLocal("auth", false);
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#252b36] bg-[#0b0c10]/95 backdrop-blur">
        <div className="flex h-full items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-[#252b36] p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={18} /></button>
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#66fcf1] text-[#0b0c10] shadow-[0_0_24px_rgba(102,252,241,.18)]"><BrainCircuit size={20} /></div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold tracking-wide">Q-XGB Finance</div>
                <div className="text-[10px] uppercase tracking-[.22em] text-slate-500">Research Workspace</div>
              </div>
            </Link>
          </div>

          <div className="relative hidden max-w-xl flex-1 px-8 md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search markets, predictions, indicators..." className="w-full rounded-xl border border-[#252b36] bg-[#151922] py-2.5 pl-9 pr-4 text-sm outline-none placeholder:text-slate-600 focus:border-[#66fcf1]/50" />
            </div>
            {matches.length > 0 && (
              <div className="absolute left-8 right-8 top-14 rounded-xl border border-[#252b36] bg-[#151922] p-2 shadow-2xl">
                {matches.slice(0, 6).map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setSearch("")} className="block rounded-lg px-3 py-2 text-sm hover:bg-white/5">{item.label}</Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-[#252b36] bg-[#151922] px-3 py-1.5 text-xs text-slate-300 sm:flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> {demo ? "Demo Mode" : "Backend Mode"}
            </div>
            <Link href="/alerts" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Alerts"><Bell size={18} /></Link>
            <Link href="/help" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Help"><HelpCircle size={18} /></Link>
            <Link href="/profile" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Profile"><CircleUserRound size={19} /></Link>
            <button onClick={logout} className="hidden rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-red-300 lg:block" aria-label="Logout"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <aside className={`fixed bottom-0 left-0 top-16 z-40 hidden border-r border-[#252b36] bg-[#0e1117] transition-all duration-200 lg:block ${collapsed ? "w-20" : "w-64"}`}>
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-3">
            {sections.map((section) => (
              <div key={section.name} className="mb-5">
                {!collapsed && <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-600">{section.name}</div>}
                {section.items.map((item) => {
                  const Icon = iconMap[item.icon] || Activity;
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  return (
                    <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? "bg-[#66fcf1]/10 text-[#66fcf1]" : "text-slate-400 hover:bg-white/5 hover:text-white"} ${collapsed ? "justify-center" : ""}`}>
                      <Icon size={17} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
          <button onClick={toggleCollapsed} className="m-3 flex items-center justify-center rounded-lg border border-[#252b36] p-2 text-slate-500 hover:text-white" aria-label="Collapse sidebar">
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)}>
          <aside className="h-full w-80 max-w-[88vw] border-r border-[#252b36] bg-[#0e1117] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div className="font-semibold">Navigation</div>
              <button className="rounded-lg p-2 hover:bg-white/5" onClick={() => setMobileOpen(false)}><X size={18} /></button>
            </div>
            {sections.map((section) => (
              <div key={section.name} className="mb-5">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[.2em] text-slate-600">{section.name}</div>
                {section.items.map((item) => {
                  const Icon = iconMap[item.icon] || Activity;
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active ? "bg-[#66fcf1]/10 text-[#66fcf1]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={17}/>{item.label}</Link>;
                })}
              </div>
            ))}
          </aside>
        </div>
      )}

      <main className={`${collapsed ? "lg:pl-20" : "lg:pl-64"} pt-16 transition-all duration-200`}>
        <div className="min-h-[calc(100vh-4rem)] px-4 py-6 md:px-6 xl:px-8">{children}</div>
      </main>
    </div>
  );
}
