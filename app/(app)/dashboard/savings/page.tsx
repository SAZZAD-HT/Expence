"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X, Trash2, PiggyBank, Minus, Pencil } from "lucide-react";
import { decrypt, encrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import { formatTaka } from "@/lib/format";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface Goal {
  id: string;
  name_encrypted: string;
  target_amount_encrypted: string;
  current_amount_encrypted: string;
  notes_encrypted: string | null;
}

export default function SavingsPage() {
  const { sessionKey } = useSessionStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [adjusting, setAdjusting] = useState<{ goal: Goal; mode: "add" | "remove" } | null>(null);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const res = await fetch("/api/savings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setGoals(await res.json());
    setLoading(false);
  }, [sessionKey]);

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

  async function remove(id: string) {
    if (!confirm("Remove this savings goal?")) return;
    const token = await getToken();
    await fetch(`/api/savings?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  const totalCurrent = goals.reduce((s, g) => s + decNum(g.current_amount_encrypted), 0);
  const totalTarget = goals.reduce((s, g) => s + decNum(g.target_amount_encrypted), 0);
  const overallPct = totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between anim-rise">
        <div>
          <span className="label-kicker">Savings</span>
          <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold mt-1">
            Your Pots
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            {goals.length} goal{goals.length === 1 ? "" : "s"} · {formatTaka(totalCurrent)} of{" "}
            {formatTaka(totalTarget)}{" "}
            {totalTarget > 0 && (
              <span className="text-[color:var(--color-text-muted)]">
                ({overallPct.toFixed(0)}%)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-xl px-5 py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] text-black font-semibold"
          style={{
            background: "linear-gradient(135deg, #00ffa3, #c6ff00)",
            boxShadow: "0 10px 30px -10px rgba(0,255,163,0.5)",
          }}
        >
          <Plus className="h-4 w-4" />
          New goal
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-[color:var(--color-neon-lime)]/30 border-t-[color:var(--color-neon-lime)] animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <p className="text-sm text-[color:var(--color-text-muted)] text-center py-12">
          No savings goals yet. Click &ldquo;New goal&rdquo; to start a pot.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const current = decNum(g.current_amount_encrypted);
            const target = decNum(g.target_amount_encrypted);
            const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            const remaining = Math.max(0, target - current);
            const done = target > 0 && current >= target;
            return (
              <article key={g.id} className="glass-card card-ticks rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/10 shrink-0">
                      <PiggyBank className="h-4 w-4 text-[color:var(--color-neon-lime)]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                        {dec(g.name_encrypted)}
                      </h3>
                      {g.notes_encrypted && (
                        <p className="text-xs text-[color:var(--color-text-muted)] line-clamp-2">
                          {dec(g.notes_encrypted)}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(g)}
                    title="Edit"
                    className="p-1.5 rounded-md text-[color:var(--color-text-muted)] hover:text-[color:var(--color-neon-cyan)] hover:bg-white/5 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className="font-[family-name:var(--font-mono)] text-2xl font-bold"
                      style={{ color: "var(--color-neon-lime)" }}
                    >
                      {formatTaka(current)}
                    </span>
                    <span className="text-xs font-[family-name:var(--font-mono)] text-[color:var(--color-text-muted)]">
                      of {formatTaka(target)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: done
                          ? "linear-gradient(90deg, #00ffa3, #c6ff00)"
                          : "linear-gradient(90deg, #00e5ff, #00ffa3)",
                        boxShadow: done
                          ? "0 0 16px rgba(0,255,163,0.6)"
                          : "0 0 16px rgba(0,229,255,0.4)",
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[0.68rem] font-[family-name:var(--font-mono)] text-[color:var(--color-text-muted)]">
                    <span>{pct.toFixed(0)}%</span>
                    <span>
                      {done ? "✓ Reached" : `${formatTaka(remaining)} to go`}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => setAdjusting({ goal: g, mode: "add" })}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] hover:border-[color:var(--color-neon-lime)] hover:text-[color:var(--color-neon-lime)] transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Deposit
                  </button>
                  <button
                    onClick={() => setAdjusting({ goal: g, mode: "remove" })}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] hover:border-[color:var(--color-warning)] hover:text-[color:var(--color-warning)] transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                    Withdraw
                  </button>
                  <button
                    onClick={() => remove(g.id)}
                    title="Delete"
                    className="p-2 rounded-lg border border-white/10 bg-white/5 text-[color:var(--color-text-muted)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showAdd && (
        <GoalModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
      {editing && (
        <GoalModal
          editingGoal={{
            id: editing.id,
            name: dec(editing.name_encrypted),
            target: decNum(editing.target_amount_encrypted),
            current: decNum(editing.current_amount_encrypted),
            notes: editing.notes_encrypted ? dec(editing.notes_encrypted) : "",
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {adjusting && (
        <AdjustModal
          goal={{
            id: adjusting.goal.id,
            name: dec(adjusting.goal.name_encrypted),
            current: decNum(adjusting.goal.current_amount_encrypted),
            target: decNum(adjusting.goal.target_amount_encrypted),
          }}
          mode={adjusting.mode}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GoalModal({
  editingGoal,
  onClose,
  onSaved,
}: {
  editingGoal?: {
    id: string;
    name: string;
    target: number;
    current: number;
    notes: string;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sessionKey } = useSessionStore();
  const [name, setName] = useState(editingGoal?.name ?? "");
  const [target, setTarget] = useState(
    editingGoal ? (editingGoal.target / 100).toFixed(2) : ""
  );
  const [current, setCurrent] = useState(
    editingGoal ? (editingGoal.current / 100).toFixed(2) : "0"
  );
  const [notes, setNotes] = useState(editingGoal?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!sessionKey) return;
    if (!name.trim()) return setError("Enter a name");
    const t = Math.round(parseFloat(target || "0") * 100);
    const c = Math.round(parseFloat(current || "0") * 100);
    if (t <= 0) return setError("Enter a positive target");
    if (c < 0) return setError("Current cannot be negative");

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const body = {
        name_encrypted: encrypt(name.trim(), sessionKey),
        target_amount_encrypted: encrypt(String(t), sessionKey),
        current_amount_encrypted: encrypt(String(c), sessionKey),
        notes_encrypted: notes.trim() ? encrypt(notes.trim(), sessionKey) : undefined,
      };
      const res = await fetch("/api/savings", {
        method: editingGoal ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingGoal ? { id: editingGoal.id, ...body } : body),
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
    <ModalShell
      kicker={editingGoal ? "Edit" : "New"}
      title={editingGoal ? "Edit goal" : "New savings goal"}
      onClose={onClose}
    >
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Emergency fund"
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target (৳)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
          />
        </Field>
        <Field label="Current (৳)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
          />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)] resize-none"
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
        {saving ? "Saving…" : editingGoal ? "Save changes" : "Create goal"}
      </button>
    </ModalShell>
  );
}

function AdjustModal({
  goal,
  mode,
  onClose,
  onSaved,
}: {
  goal: { id: string; name: string; current: number; target: number };
  mode: "add" | "remove";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sessionKey } = useSessionStore();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const delta = Math.round(parseFloat(amount || "0") * 100);
  const newCurrent =
    mode === "add" ? goal.current + delta : Math.max(0, goal.current - delta);

  async function save() {
    if (!sessionKey) return;
    if (delta <= 0) return setError("Enter a positive amount");

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/savings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: goal.id,
          current_amount_encrypted: encrypt(String(newCurrent), sessionKey),
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
    <ModalShell
      kicker={mode === "add" ? "Deposit" : "Withdraw"}
      title={`${mode === "add" ? "Deposit to" : "Withdraw from"} ${goal.name}`}
      onClose={onClose}
    >
      <Field label="Amount (৳)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-[color:var(--color-neon-lime)]"
        />
      </Field>

      <div className="rounded-xl bg-white/5 px-4 py-3 text-xs text-[color:var(--color-text-secondary)]">
        New balance:{" "}
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {formatTaka(newCurrent)}
        </span>
        {goal.target > 0 && (
          <span className="text-[color:var(--color-text-muted)]">
            {" "}· {Math.min(100, (newCurrent / goal.target) * 100).toFixed(0)}% of target
          </span>
        )}
      </div>

      {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] font-semibold text-black disabled:opacity-50"
        style={{
          background:
            mode === "add"
              ? "linear-gradient(135deg, #00ffa3, #c6ff00)"
              : "linear-gradient(135deg, #ffb300, #ff3b5c)",
          boxShadow: "0 10px 30px -10px rgba(0,255,163,0.5)",
        }}
      >
        {saving ? "Saving…" : mode === "add" ? "Deposit" : "Withdraw"}
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
