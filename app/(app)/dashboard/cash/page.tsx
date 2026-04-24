"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X, Trash2, Banknote, Pencil, TrendingUp, Receipt } from "lucide-react";
import Link from "next/link";
import { decrypt, encrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import { formatTaka } from "@/lib/format";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface Inflow {
  id: string;
  amount_encrypted: string;
  source_encrypted: string;
  note_encrypted: string | null;
  inflow_date: string;
}

interface ExpenseRow {
  id: string;
  amount_encrypted: string;
  payment_method: string;
  expense_date: string;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function CashPage() {
  const { sessionKey } = useSessionStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [inflows, setInflows] = useState<Inflow[]>([]);
  const [cashExpenses, setCashExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showInflowModal, setShowInflowModal] = useState(false);

  const month = currentMonth();

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const [bRes, iRes, eRes] = await Promise.all([
      fetch("/api/cash-balance", { headers: h }),
      fetch(`/api/cash-inflows?month=${month}`, { headers: h }),
      fetch(`/api/expenses?month=${month}`, { headers: h }),
    ]);
    if (bRes.ok) {
      const row = await bRes.json();
      if (row && row.balance_encrypted) {
        try {
          setBalance(parseInt(decrypt(row.balance_encrypted, sessionKey), 10) || 0);
        } catch {
          setBalance(null);
        }
      } else {
        setBalance(null);
      }
    }
    if (iRes.ok) setInflows(await iRes.json());
    if (eRes.ok) {
      const all = (await eRes.json()) as ExpenseRow[];
      setCashExpenses(all.filter((e) => e.payment_method === "cash"));
    }
    setLoading(false);
  }, [sessionKey, month]);

  useEffect(() => {
    load();
  }, [load]);

  function dec(c: string): string {
    try {
      return decrypt(c, sessionKey!);
    } catch {
      return "";
    }
  }
  function decNum(c: string): number {
    return parseInt(dec(c), 10) || 0;
  }

  const monthInflowTotal = inflows.reduce((s, i) => s + decNum(i.amount_encrypted), 0);
  const monthCashSpentTotal = cashExpenses.reduce(
    (s, e) => s + decNum(e.amount_encrypted),
    0
  );

  async function deleteInflow(id: string) {
    if (!confirm("Remove this inflow entry?")) return;
    const token = await getToken();
    await fetch(`/api/cash-inflows?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between anim-rise">
        <div>
          <span className="label-kicker">Cash</span>
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold mt-1">
            Cash in Hand
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            {month} · {inflows.length} inflow{inflows.length === 1 ? "" : "s"} · {cashExpenses.length} cash expense{cashExpenses.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInflowModal(true)}
            className="flex items-center gap-1.5 rounded-xl px-5 py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] text-black font-semibold"
            style={{
              background: "linear-gradient(135deg, #00ffa3, #c6ff00)",
              boxShadow: "0 10px 30px -10px rgba(0,255,163,0.5)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add inflow
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-[color:var(--color-neon-lime)]/30 border-t-[color:var(--color-neon-lime)] animate-spin" />
        </div>
      ) : (
        <>
          {/* Balance + month totals */}
          <section className="grid lg:grid-cols-3 gap-5">
            <article className="hero-card card-ticks lg:col-span-2 rounded-3xl p-7 md:p-8 anim-rise">
              <div className="flex items-center justify-between">
                <span className="label-kicker">Cash in hand</span>
                <button
                  onClick={() => setShowBalanceModal(true)}
                  className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:border-white/20 transition-colors font-[family-name:var(--font-mono)]"
                >
                  <Pencil className="h-3 w-3" />
                  {balance !== null ? "Edit" : "Set"}
                </button>
              </div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="digits-hero text-[3rem] md:text-[4.5rem] leading-none">
                  {balance !== null ? formatTaka(balance) : "— —"}
                </span>
              </div>
              {balance === null && (
                <p className="mt-3 text-sm text-[color:var(--color-text-secondary)]">
                  Click &ldquo;Set&rdquo; to record how much cash you currently hold.
                </p>
              )}
            </article>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <MetricCard
                icon={TrendingUp}
                label="Inflows this month"
                value={formatTaka(monthInflowTotal)}
                tone="lime"
              />
              <MetricCard
                icon={Receipt}
                label="Cash spent this month"
                value={formatTaka(monthCashSpentTotal)}
                tone="warning"
              />
            </div>
          </section>

          {/* Inflows list */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="label-kicker">Inflows · {inflows.length}</span>
              <span className="text-[0.68rem] text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)]">
                {month}
              </span>
            </div>
            {inflows.length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-muted)] py-6 text-center">
                No inflows this month. Log bonuses, freelance, gifts, or any cash income.
              </p>
            ) : (
              <div className="glass-card card-ticks rounded-2xl divide-y divide-white/5">
                {inflows.map((i) => (
                  <div
                    key={i.id}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--color-neon-lime)]/15 shrink-0">
                      <Banknote className="h-4 w-4 text-[color:var(--color-neon-lime)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                          {dec(i.source_encrypted)}
                        </p>
                        <span className="text-[0.68rem] text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)]">
                          {i.inflow_date}
                        </span>
                      </div>
                      {i.note_encrypted && (
                        <p className="text-xs text-[color:var(--color-text-muted)] truncate">
                          {dec(i.note_encrypted)}
                        </p>
                      )}
                    </div>
                    <span
                      className="font-[family-name:var(--font-mono)] font-semibold text-sm"
                      style={{ color: "var(--color-neon-lime)" }}
                    >
                      +{formatTaka(decNum(i.amount_encrypted))}
                    </span>
                    <button
                      onClick={() => deleteInflow(i.id)}
                      title="Remove inflow"
                      className="p-1.5 rounded-md text-[color:var(--color-text-muted)] hover:text-[color:var(--color-danger)] hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Cash expenses pointer */}
          <section className="rounded-2xl border border-white/5 bg-white/5 px-5 py-4 flex items-center gap-3">
            <Receipt className="h-4 w-4 text-[color:var(--color-text-muted)]" />
            <p className="text-sm text-[color:var(--color-text-secondary)] flex-1">
              Log cash purchases under{" "}
              <Link
                href="/dashboard/expenses"
                className="text-[color:var(--color-neon-cyan)] hover:underline"
              >
                Expenses
              </Link>{" "}
              with <span className="font-mono">Payment method = Cash</span>.
            </p>
          </section>
        </>
      )}

      {showBalanceModal && (
        <BalanceModal
          current={balance}
          onClose={() => setShowBalanceModal(false)}
          onSaved={() => {
            setShowBalanceModal(false);
            load();
          }}
        />
      )}
      {showInflowModal && (
        <InflowModal
          onClose={() => setShowInflowModal(false)}
          onSaved={() => {
            setShowInflowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone: "lime" | "warning";
}) {
  const color = tone === "lime" ? "var(--color-neon-lime)" : "var(--color-warning)";
  return (
    <article className="glass-card card-ticks rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="label-kicker">{label}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div
        className="mt-3 font-[family-name:var(--font-mono)] font-bold text-2xl md:text-[1.75rem] leading-none"
        style={{ color }}
      >
        {value}
      </div>
    </article>
  );
}

function BalanceModal({
  current,
  onClose,
  onSaved,
}: {
  current: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sessionKey } = useSessionStore();
  const [input, setInput] = useState(current !== null ? (current / 100).toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!sessionKey) return;
    const paise = Math.round(parseFloat(input || "0") * 100);
    if (paise < 0) return setError("Balance must be zero or positive");

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/cash-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ balance_encrypted: encrypt(String(paise), sessionKey) }),
      });
      if (res.ok) onSaved();
      else {
        const e = await res.json();
        setError(typeof e.error === "string" ? e.error : "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell kicker="Balance" title="Set cash in hand" onClose={onClose}>
      <Field label="Amount (৳)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
        />
      </Field>

      {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] font-semibold text-black disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, #00ffa3, #c6ff00)",
          boxShadow: "0 10px 30px -10px rgba(0,255,163,0.5)",
        }}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </ModalShell>
  );
}

function InflowModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { sessionKey } = useSessionStore();
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = ["Bonus", "Freelance", "Gift", "Refund", "Sale", "Side work"];

  async function save() {
    if (!sessionKey) return;
    if (!source.trim()) return setError("Enter a source");
    const paise = Math.round(parseFloat(amount || "0") * 100);
    if (paise <= 0) return setError("Enter a positive amount");

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/cash-inflows", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount_encrypted: encrypt(String(paise), sessionKey),
          source_encrypted: encrypt(source.trim(), sessionKey),
          note_encrypted: note.trim() ? encrypt(note.trim(), sessionKey) : undefined,
          inflow_date: date,
        }),
      });
      if (res.ok) onSaved();
      else {
        const e = await res.json();
        setError(typeof e.error === "string" ? e.error : "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell kicker="Inflow" title="Log cash inflow" onClose={onClose}>
      <Field label="Source">
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. Freelance — Acme Co."
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className="rounded-full border border-white/10 px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-neon-lime)] hover:border-[color:var(--color-neon-lime)] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Amount (৳)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
        />
      </Field>
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
        />
      </Field>
      <Field label="Note (optional)">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
        />
      </Field>

      <div className="rounded-xl bg-white/5 px-4 py-3 text-xs text-[color:var(--color-text-secondary)]">
        Tip: logging an inflow does not automatically change your cash balance. Update the balance
        above if this cash is now in your hand.
      </div>

      {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] font-semibold text-black disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, #00ffa3, #c6ff00)",
          boxShadow: "0 10px 30px -10px rgba(0,255,163,0.5)",
        }}
      >
        {saving ? "Saving…" : "Log inflow"}
      </button>
    </ModalShell>
  );
}

function ModalShell({
  kicker,
  title,
  onClose,
  children,
}: {
  kicker: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse at center, rgba(5,5,16,0.75), rgba(5,5,16,0.95))",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="glass-card card-ticks rounded-3xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto space-y-4 anim-rise">
        <div className="flex items-center justify-between">
          <div>
            <span className="label-kicker">{kicker}</span>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-full border border-white/10 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-neon-magenta)] hover:border-[color:var(--color-neon-magenta)] transition-colors flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[color:var(--color-text-primary)]">{label}</label>
      {children}
    </div>
  );
}
