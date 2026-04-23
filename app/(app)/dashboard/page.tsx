"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, TrendingUp, TrendingDown, Activity, AlertTriangle } from "lucide-react";
import { decrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import SpendingBarChart from "@/components/charts/spending-bar-chart";
import SegmentDonutChart from "@/components/charts/segment-donut-chart";
import ExpenseForm from "@/components/expense-form";
import { formatTaka } from "@/lib/format";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface ExpenseRow {
  id: string;
  amount_encrypted: string;
  category_id: string | null;
  expense_date: string;
  payment_method: string;
}
interface SegmentRow {
  id: string;
  name: string;
  monthly_limit_encrypted: string;
  color_tag: string | null;
}
interface CategoryRow { id: string; segment_id: string | null; }
interface LoanRow { id: string; emi_amount_encrypted: string; }
interface CardRow { id: string; current_balance_encrypted: string; minimum_due_encrypted: string; }

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekLabel(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return `${start.getMonth() + 1}/${start.getDate()}`;
}

function monthLabel() {
  return new Date().toLocaleDateString("en-BD", { month: "long", year: "numeric" }).toUpperCase();
}

export default function DashboardPage() {
  const { sessionKey } = useSessionStore();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const month = currentMonth();
    const [expRes, segRes, catRes, loanRes, cardRes] = await Promise.all([
      fetch(`/api/expenses?month=${month}`, { headers: h }),
      fetch("/api/budget", { headers: h }),
      fetch("/api/categories", { headers: h }),
      fetch("/api/loans", { headers: h }),
      fetch("/api/credit-cards", { headers: h }),
    ]);
    if (expRes.ok) setExpenses(await expRes.json());
    if (segRes.ok) setSegments(await segRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    if (loanRes.ok) setLoans(await loanRes.json());
    if (cardRes.ok) setCards(await cardRes.json());
    setLoading(false);
  }, [sessionKey]);

  useEffect(() => { load(); }, [load]);

  if (!sessionKey || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[color:var(--color-neon-cyan)]/30 border-t-[color:var(--color-neon-cyan)] animate-spin" />
          <span className="label-kicker">Decrypting…</span>
        </div>
      </div>
    );
  }

  function dec(c: string): number {
    try { return parseInt(decrypt(c, sessionKey!), 10) || 0; } catch { return 0; }
  }

  const totalSpent = expenses.reduce((s, e) => s + dec(e.amount_encrypted), 0);
  const catSegMap = new Map<string, string | null>(categories.map((c) => [c.id, c.segment_id]));
  const segLimitMap = new Map<string, number>(
    segments.map((s) => [s.id, dec(s.monthly_limit_encrypted)])
  );
  const totalBudget = Array.from(segLimitMap.values()).reduce((a, b) => a + b, 0);
  const budgetRemaining = totalBudget - totalSpent;
  const pctUsed = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const totalEmi = loans.reduce((s, l) => s + dec(l.emi_amount_encrypted), 0);
  const totalCcDues = cards.reduce((s, c) => s + dec(c.minimum_due_encrypted), 0);

  const weekMap = new Map<string, number>();
  expenses.forEach((e) => {
    const d = new Date(e.expense_date);
    const label = getWeekLabel(d);
    weekMap.set(label, (weekMap.get(label) ?? 0) + dec(e.amount_encrypted));
  });
  const weekData = Array.from(weekMap.entries()).slice(-4).map(([week, total]) => ({ week, total }));

  const segSpent = new Map<string, number>();
  expenses.forEach((e) => {
    const segId = e.category_id ? (catSegMap.get(e.category_id) ?? null) : null;
    if (segId) segSpent.set(segId, (segSpent.get(segId) ?? 0) + dec(e.amount_encrypted));
  });
  const donutData = segments
    .filter((s) => (segSpent.get(s.id) ?? 0) > 0)
    .map((s) => ({ name: s.name, value: segSpent.get(s.id) ?? 0, color: s.color_tag ?? "" }));

  const healthy = budgetRemaining >= 0;
  const overBy = Math.max(0, -budgetRemaining);

  const secondaryCards = [
    {
      label: "Budget Left",
      value: formatTaka(Math.max(0, budgetRemaining)),
      sub: healthy ? `of ${formatTaka(totalBudget)}` : `OVER BY ${formatTaka(overBy)}`,
      tone: healthy ? "cyan" : "danger",
      Icon: healthy ? TrendingDown : AlertTriangle,
    },
    {
      label: "Monthly EMI",
      value: formatTaka(totalEmi),
      sub: `${loans.length} active loan${loans.length === 1 ? "" : "s"}`,
      tone: "lime",
      Icon: Activity,
    },
    {
      label: "Card Dues",
      value: formatTaka(totalCcDues),
      sub: totalCcDues > 0 ? "MIN. DUE" : "ALL CLEAR",
      tone: totalCcDues > 0 ? "warning" : "safe",
      Icon: TrendingUp,
    },
  ] as const;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* ========== Header ========== */}
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between anim-rise">
        <div>
          <div className="flex items-center gap-3">
            <span className="label-kicker">{monthLabel()} · Overview</span>
            <span className="chip-neon text-[color:var(--color-neon-cyan)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-neon-cyan)] anim-pulse-glow" style={{ boxShadow: "0 0 8px #00e5ff" }} />
              LIVE
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold mt-1 text-white">
            Tonight&apos;s Ledger
          </h1>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="group relative overflow-hidden rounded-xl px-5 py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] text-black font-semibold transition-transform hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
            boxShadow: "0 10px 40px -10px rgba(0,229,255,0.6), 0 20px 60px -20px rgba(255,43,214,0.5)",
          }}
        >
          <span className="relative z-10 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Log Expense
          </span>
        </button>
      </header>

      {/* ========== Hero + Secondaries ========== */}
      <section className="grid lg:grid-cols-3 gap-5">
        {/* Hero spend card */}
        <article className="hero-card card-ticks lg:col-span-2 rounded-3xl p-7 md:p-9 anim-rise" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between">
            <span className="label-kicker">Month Spend</span>
            <span className="chip-neon text-[color:var(--color-neon-magenta)]">
              {expenses.length} entries
            </span>
          </div>
          <div className="mt-6 md:mt-8 flex items-baseline gap-1">
            <span className="digits-hero text-[3.5rem] md:text-[5.5rem] leading-none">
              {formatTaka(totalSpent)}
            </span>
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="label-kicker">Budget Consumption</span>
              <span className="font-[family-name:var(--font-mono)] text-xs text-white/70">
                {pctUsed.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/5 border border-white/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pctUsed}%`,
                  background:
                    pctUsed > 90
                      ? "linear-gradient(90deg, #ffb300, #ff3b5c)"
                      : pctUsed > 70
                      ? "linear-gradient(90deg, #c6ff00, #ffb300)"
                      : "linear-gradient(90deg, #00e5ff, #ff2bd6)",
                  boxShadow:
                    pctUsed > 90
                      ? "0 0 20px rgba(255,59,92,0.6)"
                      : "0 0 18px rgba(0,229,255,0.45)",
                }}
              />
            </div>
          </div>
        </article>

        {/* Stack of 3 secondaries */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
          {secondaryCards.map((c, i) => {
            const toneColor =
              c.tone === "cyan" ? "#00e5ff"
              : c.tone === "lime" ? "#c6ff00"
              : c.tone === "warning" ? "#ffb300"
              : c.tone === "danger" ? "#ff3b5c"
              : "#00ffa3";
            return (
              <article
                key={c.label}
                className="glass-card card-ticks rounded-2xl p-5 anim-rise hover:[&]:glass-card-hover"
                style={{ animationDelay: `${120 + i * 80}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="label-kicker">{c.label}</span>
                  <c.Icon className="h-4 w-4" style={{ color: toneColor, filter: `drop-shadow(0 0 6px ${toneColor})` }} />
                </div>
                <div
                  className="mt-3 font-[family-name:var(--font-mono)] font-bold text-2xl md:text-[1.75rem] leading-none"
                  style={{ color: toneColor, textShadow: `0 0 18px ${toneColor}55` }}
                >
                  {c.value}
                </div>
                <p className="mt-2 font-[family-name:var(--font-mono)] text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
                  {c.sub}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* ========== Charts ========== */}
      <section className="grid lg:grid-cols-2 gap-5 anim-rise" style={{ animationDelay: "320ms" }}>
        <article className="glass-card card-ticks rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="label-kicker">Weekly Signal</span>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">
                Spending Pulse
              </h2>
            </div>
            <span className="chip-neon text-[color:var(--color-neon-cyan)]">last 4w</span>
          </div>
          <SpendingBarChart data={weekData} />
        </article>

        <article className="glass-card card-ticks rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="label-kicker">Segment Split</span>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold">
                Where it went
              </h2>
            </div>
            <span className="chip-neon text-[color:var(--color-neon-magenta)]">{donutData.length} active</span>
          </div>
          <SegmentDonutChart data={donutData} />
        </article>
      </section>

      {/* ========== Modal ========== */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "radial-gradient(ellipse at center, rgba(5,5,16,0.75), rgba(5,5,16,0.95))", backdropFilter: "blur(12px)" }}
        >
          <div className="glass-card card-ticks rounded-3xl p-7 w-full max-w-md max-h-[90vh] overflow-y-auto anim-rise">
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="label-kicker">Action</span>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold">
                  New Expense
                </h2>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="h-8 w-8 rounded-full border border-white/10 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-neon-magenta)] hover:border-[color:var(--color-neon-magenta)] transition-colors flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ExpenseForm
              onSuccess={() => {
                setShowAddForm(false);
                load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
