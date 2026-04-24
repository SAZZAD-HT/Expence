"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, AlertTriangle, Plus, Wallet, X, Trash2, Pencil } from "lucide-react";
import { decrypt, encrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import {
  isPaymentDueSoon,
  nextBillingDate,
  interestFreePeriodEnd,
  calculateMinimumDue,
} from "@/lib/credit-card-math";
import { createBrowserClient } from "@/lib/supabase";
import { formatTaka } from "@/lib/format";

interface Card {
  id: string;
  card_name_encrypted: string;
  credit_limit_encrypted: string;
  billing_cycle_day: number;
  interest_free_days: number;
  current_balance_encrypted: string;
  minimum_due_encrypted: string;
  existing_emi_count: number;
  existing_emi_amount_encrypted: string | null;
}

interface Emi {
  id: string;
  card_id: string;
  name_encrypted: string;
  principal_encrypted: string;
  monthly_amount_encrypted: string;
  tenure_months: number;
  months_paid: number;
  start_date: string;
  status: string;
}

interface Payment {
  id: string;
  card_id: string;
  amount_encrypted: string;
  payment_date: string;
  note_encrypted: string | null;
}

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Last billing cycle date that is on/before today. If billing day is 15 and
 * today is the 10th, returns the 15th of last month.
 */
function lastStatementDate(billingCycleDay: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let y = today.getFullYear();
  let m = today.getMonth() + 1; // 1-indexed
  const lastDay = (yy: number, mm: number) => new Date(yy, mm, 0).getDate();
  const clamp = (yy: number, mm: number) => Math.min(billingCycleDay, lastDay(yy, mm));
  const thisMonthStmt = new Date(y, m - 1, clamp(y, m));
  if (thisMonthStmt <= today) {
    const d = thisMonthStmt;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  const d = new Date(y, m - 1, clamp(y, m));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/* Card item                                                                  */
/* -------------------------------------------------------------------------- */

export function CreditCardPanelItem({
  card,
  onDelete,
  onRefresh,
}: {
  card: Card;
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
}) {
  const { sessionKey } = useSessionStore();
  const [emis, setEmis] = useState<Emi[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showEmiModal, setShowEmiModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!sessionKey) return;
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const [eRes, pRes] = await Promise.all([
      fetch(`/api/card-emis?card_id=${card.id}`, { headers: h }),
      fetch(`/api/card-payments?card_id=${card.id}`, { headers: h }),
    ]);
    if (eRes.ok) setEmis(await eRes.json());
    if (pRes.ok) setPayments(await pRes.json());
  }, [card.id, sessionKey]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  if (!sessionKey) return null;

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

  const name = dec(card.card_name_encrypted);
  const limit = decNum(card.credit_limit_encrypted);
  const balance = decNum(card.current_balance_encrypted);
  const minDue = decNum(card.minimum_due_encrypted);
  const available = Math.max(0, limit - balance);
  const usedPct = limit > 0 ? Math.min((balance / limit) * 100, 100) : 0;
  const nextDue = nextBillingDate(card.billing_cycle_day);
  const dueSoon = isPaymentDueSoon(nextDue);
  const intFreeEnd = interestFreePeriodEnd(
    todayIso(),
    card.billing_cycle_day,
    card.interest_free_days
  );

  const activeEmis = emis.filter((e) => e.status === "active");
  const emiMonthlyTotal = activeEmis.reduce(
    (s, e) => s + decNum(e.monthly_amount_encrypted),
    0
  );
  // Outstanding EMI principal = sum of (monthly × months remaining) across active EMIs.
  const emiOutstanding = activeEmis.reduce((s, e) => {
    const monthly = decNum(e.monthly_amount_encrypted);
    const remaining = Math.max(0, e.tenure_months - e.months_paid);
    return s + monthly * remaining;
  }, 0);

  const paidAllTime = payments.reduce((s, p) => s + decNum(p.amount_encrypted), 0);

  // Total balance = card balance + outstanding EMI principal.
  const totalBalance = balance + emiOutstanding;

  // Statement balance: what the card statement billed you (approximation).
  // current_balance + payments made on/after the last statement date.
  const stmtDate = lastStatementDate(card.billing_cycle_day);
  const paidSinceStatement = payments
    .filter((p) => p.payment_date >= stmtDate)
    .reduce((s, p) => s + decNum(p.amount_encrypted), 0);
  const statementBalance = balance + paidSinceStatement;

  let barColor = "bg-[color:var(--color-safe)]";
  if (usedPct >= 90) barColor = "bg-[color:var(--color-danger)]";
  else if (usedPct >= 70) barColor = "bg-[color:var(--color-warning)]";

  return (
    <>
      <div className="glass-card card-ticks rounded-xl p-4 space-y-3">
        {/* header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/10">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">{name}</h3>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Billing day {card.billing_cycle_day} · {card.interest_free_days}d interest-free
              </p>
            </div>
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(card.id)}
              className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-danger)] transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        {/* stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label="Total balance"
            value={formatTaka(totalBalance)}
            sub={emiOutstanding > 0 ? `incl. ${formatTaka(emiOutstanding)} EMI` : undefined}
            onEdit={() => setShowBalanceModal(true)}
          />
          <Stat label="Statement balance" value={formatTaka(statementBalance)} tone="warning" />
          <Stat label="Card (non-EMI)" value={formatTaka(balance)} />
          <Stat label="Available" value={formatTaka(available)} tone="safe" />
          <Stat
            label="Minimum Due"
            value={formatTaka(minDue + emiMonthlyTotal)}
            sub={emiMonthlyTotal > 0 ? `incl. ${formatTaka(emiMonthlyTotal)} EMI` : undefined}
          />
          <Stat
            label="Next Due"
            value={nextDue}
            tone={dueSoon ? "danger" : undefined}
          />
          <Stat label="Paid all-time" value={formatTaka(paidAllTime)} />
          <Stat label="Last statement" value={stmtDate} />
        </div>

        {/* utilisation */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-[color:var(--color-text-muted)]">
            <span>Credit used</span>
            <span>{usedPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${usedPct}%` }}
            />
          </div>
        </div>

        {dueSoon && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 px-3 py-2 text-xs text-[color:var(--color-danger)]">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Payment due soon — {nextDue}
          </div>
        )}

        <div className="text-xs text-[color:var(--color-text-muted)]">
          Interest-free until: <span className="text-[color:var(--color-text-secondary)]">{intFreeEnd}</span>
        </div>

        {/* action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setShowPayModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] hover:border-[color:var(--color-neon-cyan)] hover:text-[color:var(--color-neon-cyan)] transition-colors"
          >
            <Wallet className="h-3.5 w-3.5" />
            Record payment
          </button>
          <button
            onClick={() => setShowEmiModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] hover:border-[color:var(--color-neon-magenta)] hover:text-[color:var(--color-neon-magenta)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add EMI
          </button>
        </div>

        {/* EMIs list */}
        {activeEmis.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="label-kicker">Active EMIs · {formatTaka(emiMonthlyTotal)}/mo</span>
              <span className="text-[0.68rem] text-[color:var(--color-text-muted)]">{activeEmis.length}</span>
            </div>
            {activeEmis.map((e) => {
              const emiName = dec(e.name_encrypted);
              const monthly = decNum(e.monthly_amount_encrypted);
              const remaining = Math.max(0, e.tenure_months - e.months_paid);
              return (
                <EmiRow
                  key={e.id}
                  id={e.id}
                  name={emiName}
                  monthly={monthly}
                  remaining={remaining}
                  tenure={e.tenure_months}
                  monthsPaid={e.months_paid}
                  onRemove={async () => {
                    const token = await getToken();
                    await fetch(`/api/card-emis?id=${e.id}`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    loadChildren();
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <span className="label-kicker">Payment history · {payments.length}</span>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {payments.map((p) => {
                const amt = decNum(p.amount_encrypted);
                const note = p.note_encrypted ? dec(p.note_encrypted) : "";
                return (
                  <div
                    key={p.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[color:var(--color-text-secondary)] font-[family-name:var(--font-mono)]">
                        {p.payment_date}
                        {note && (
                          <span className="ml-2 text-[color:var(--color-text-muted)]">
                            — {note}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[color:var(--color-neon-cyan)] font-[family-name:var(--font-mono)]">
                      {formatTaka(amt)}
                    </span>
                    <button
                      title="Delete payment (rolls amount back into balance)"
                      onClick={async () => {
                        if (!sessionKey) return;
                        if (
                          !confirm(
                            `Remove payment of ${formatTaka(amt)} on ${p.payment_date}? The amount will be added back to the card balance.`
                          )
                        )
                          return;
                        const newBalance = balance + amt;
                        const newMinDue = calculateMinimumDue(newBalance);
                        const token = await getToken();
                        const res = await fetch("/api/card-payments", {
                          method: "DELETE",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            id: p.id,
                            card_id: card.id,
                            new_balance_encrypted: encrypt(String(newBalance), sessionKey),
                            new_minimum_due_encrypted: encrypt(String(newMinDue), sessionKey),
                          }),
                        });
                        if (res.ok) {
                          loadChildren();
                          onRefresh?.();
                        } else {
                          alert("Failed to delete payment");
                        }
                      }}
                      className="p-1 rounded text-[color:var(--color-text-muted)] hover:text-[color:var(--color-danger)] hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showPayModal && (
        <PaymentModal
          card={card}
          currentBalance={balance}
          minDue={minDue}
          activeEmis={activeEmis}
          emiMonthlyTotal={emiMonthlyTotal}
          onClose={() => setShowPayModal(false)}
          onSaved={() => {
            setShowPayModal(false);
            loadChildren();
            onRefresh?.();
          }}
        />
      )}
      {showEmiModal && (
        <EmiModal
          cardId={card.id}
          onClose={() => setShowEmiModal(false)}
          onSaved={() => {
            setShowEmiModal(false);
            loadChildren();
          }}
        />
      )}
      {showBalanceModal && (
        <BalanceModal
          card={card}
          currentBalance={balance}
          emiOutstanding={emiOutstanding}
          onClose={() => setShowBalanceModal(false)}
          onSaved={() => {
            setShowBalanceModal(false);
            loadChildren();
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Balance edit modal                                                         */
/* -------------------------------------------------------------------------- */

function BalanceModal({
  card,
  currentBalance,
  emiOutstanding,
  onClose,
  onSaved,
}: {
  card: Card;
  currentBalance: number;
  emiOutstanding: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sessionKey } = useSessionStore();
  const [mode, setMode] = useState<"total" | "card">("total");
  const [input, setInput] = useState(
    ((currentBalance + emiOutstanding) / 100).toFixed(2)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(m: "total" | "card") {
    setMode(m);
    const next =
      m === "total"
        ? ((currentBalance + emiOutstanding) / 100).toFixed(2)
        : (currentBalance / 100).toFixed(2);
    setInput(next);
  }

  async function save() {
    if (!sessionKey) return;
    const paise = Math.round(parseFloat(input || "0") * 100);
    if (paise < 0) {
      setError("Balance must be zero or positive");
      return;
    }
    // If user entered total-including-EMI, subtract the EMI portion to get
    // the card (non-EMI) balance that we actually store.
    const newCardBalance =
      mode === "total" ? Math.max(0, paise - emiOutstanding) : paise;
    const newMinDue = calculateMinimumDue(newCardBalance);

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/credit-cards", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: card.id,
          current_balance_encrypted: encrypt(String(newCardBalance), sessionKey),
          minimum_due_encrypted: encrypt(String(newMinDue), sessionKey),
        }),
      });
      if (res.ok) onSaved();
      else {
        const e = await res.json();
        setError(typeof e.error === "string" ? e.error : "Failed to update balance");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell kicker="Balance" title="Edit card balance" onClose={onClose}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchMode("total")}
          className={`flex-1 rounded-lg px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] border transition-colors ${
            mode === "total"
              ? "border-[color:var(--color-neon-cyan)] text-[color:var(--color-neon-cyan)] bg-[color:var(--color-neon-cyan)]/10"
              : "border-white/10 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          }`}
        >
          Total (incl. EMI)
        </button>
        <button
          type="button"
          onClick={() => switchMode("card")}
          className={`flex-1 rounded-lg px-3 py-2 text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] border transition-colors ${
            mode === "card"
              ? "border-[color:var(--color-neon-cyan)] text-[color:var(--color-neon-cyan)] bg-[color:var(--color-neon-cyan)]/10"
              : "border-white/10 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          }`}
        >
          Card only
        </button>
      </div>

      <Field label={mode === "total" ? "Total balance (৳)" : "Card balance, non-EMI (৳)"}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-neon-cyan)]"
        />
      </Field>

      {emiOutstanding > 0 && (
        <div className="rounded-xl bg-white/5 px-4 py-3 text-xs text-[color:var(--color-text-secondary)] space-y-0.5">
          <div>
            EMI outstanding:{" "}
            <span className="font-semibold text-[color:var(--color-text-primary)]">
              {formatTaka(emiOutstanding)}
            </span>
          </div>
          <div>
            Card portion after save:{" "}
            <span className="font-semibold text-[color:var(--color-text-primary)]">
              {formatTaka(
                Math.max(
                  0,
                  (mode === "total"
                    ? Math.max(0, Math.round(parseFloat(input || "0") * 100) - emiOutstanding)
                    : Math.round(parseFloat(input || "0") * 100))
                )
              )}
            </span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

      <PrimaryButton disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save balance"}
      </PrimaryButton>
    </ModalShell>
  );
}

function Stat({
  label,
  value,
  tone,
  sub,
  onEdit,
}: {
  label: string;
  value: string;
  tone?: "safe" | "danger" | "cyan" | "warning";
  sub?: string;
  onEdit?: () => void;
}) {
  const color =
    tone === "safe"
      ? "var(--color-safe)"
      : tone === "danger"
      ? "var(--color-danger)"
      : tone === "warning"
      ? "var(--color-warning)"
      : tone === "cyan"
      ? "var(--color-neon-cyan)"
      : "var(--color-text-primary)";
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 px-3 py-2">
      <div className="flex items-center justify-between gap-1">
        <p className="text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)]">
          {label}
        </p>
        {onEdit && (
          <button
            onClick={onEdit}
            title="Edit"
            className="p-0.5 rounded text-[color:var(--color-text-muted)] hover:text-[color:var(--color-neon-cyan)] transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      <p
        className="text-sm font-semibold font-[family-name:var(--font-mono)]"
        style={{ color }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-[color:var(--color-text-muted)] mt-0.5 font-[family-name:var(--font-mono)]">
          {sub}
        </p>
      )}
    </div>
  );
}

function EmiRow({
  id,
  name,
  monthly,
  remaining,
  tenure,
  monthsPaid,
  onRemove,
}: {
  id: string;
  name: string;
  monthly: number;
  remaining: number;
  tenure: number;
  monthsPaid: number;
  onRemove: () => void;
}) {
  return (
    <div
      key={id}
      className="flex items-center justify-between rounded-lg bg-white/5 border border-white/5 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[color:var(--color-text-primary)]">{name}</p>
        <p className="text-[0.68rem] text-[color:var(--color-text-muted)] font-[family-name:var(--font-mono)]">
          {formatTaka(monthly)}/mo · {monthsPaid}/{tenure} paid · {remaining} left
        </p>
      </div>
      <button
        onClick={onRemove}
        title="Remove EMI"
        className="p-1.5 rounded-md text-[color:var(--color-text-muted)] hover:text-[color:var(--color-danger)] hover:bg-white/5 transition-colors shrink-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment modal                                                              */
/* -------------------------------------------------------------------------- */

function PaymentModal({
  card,
  currentBalance,
  minDue,
  activeEmis,
  emiMonthlyTotal,
  onClose,
  onSaved,
}: {
  card: Card;
  currentBalance: number;
  minDue: number;
  activeEmis: Emi[];
  emiMonthlyTotal: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sessionKey } = useSessionStore();
  const totalMinimum = minDue + emiMonthlyTotal;
  const [amount, setAmount] = useState(
    totalMinimum > 0 ? (totalMinimum / 100).toFixed(2) : ""
  );
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paisePreview = Math.round(parseFloat(amount || "0") * 100);
  const advancesEmis = paisePreview >= totalMinimum && activeEmis.length > 0;

  async function save() {
    if (!sessionKey) return;
    const paise = paisePreview;
    if (paise <= 0) {
      setError("Enter a positive amount");
      return;
    }
    const newBalance = Math.max(0, currentBalance - paise);
    const newMinDue = calculateMinimumDue(newBalance);

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/card-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_id: card.id,
          amount_encrypted: encrypt(String(paise), sessionKey),
          payment_date: date,
          note_encrypted: note.trim() ? encrypt(note.trim(), sessionKey) : undefined,
          new_balance_encrypted: encrypt(String(newBalance), sessionKey),
          new_minimum_due_encrypted: encrypt(String(newMinDue), sessionKey),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        setError(typeof e.error === "string" ? e.error : "Failed to record payment");
        return;
      }

      // If the payment covers the full minimum (including EMIs), advance each
      // active EMI by one month.
      if (advancesEmis) {
        await Promise.all(
          activeEmis.map((e) => {
            const newMonthsPaid = e.months_paid + 1;
            const body: Record<string, unknown> = {
              id: e.id,
              months_paid: newMonthsPaid,
            };
            if (newMonthsPaid >= e.tenure_months) body.status = "closed";
            return fetch("/api/card-emis", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(body),
            });
          })
        );
      }

      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell kicker="Payment" title="Record card payment" onClose={onClose}>
      {totalMinimum > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs space-y-1">
          <div className="flex justify-between text-[color:var(--color-text-secondary)]">
            <span>Min due (bank)</span>
            <span className="font-[family-name:var(--font-mono)]">{formatTaka(minDue)}</span>
          </div>
          {emiMonthlyTotal > 0 && (
            <div className="flex justify-between text-[color:var(--color-text-secondary)]">
              <span>EMI this month ({activeEmis.length})</span>
              <span className="font-[family-name:var(--font-mono)]">{formatTaka(emiMonthlyTotal)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-white/10 text-[color:var(--color-text-primary)] font-semibold">
            <span>Total minimum</span>
            <span className="font-[family-name:var(--font-mono)]">{formatTaka(totalMinimum)}</span>
          </div>
        </div>
      )}

      <Field label="Amount (৳)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-neon-cyan)]"
        />
      </Field>

      {activeEmis.length > 0 && (
        <div
          className={`rounded-lg px-3 py-2 text-xs font-[family-name:var(--font-mono)] ${
            advancesEmis
              ? "bg-[color:var(--color-safe)]/10 text-[color:var(--color-safe)] border border-[color:var(--color-safe)]/30"
              : "bg-white/5 text-[color:var(--color-text-muted)] border border-white/5"
          }`}
        >
          {advancesEmis
            ? `✓ ${activeEmis.length} active EMI${activeEmis.length === 1 ? "" : "s"} will advance by one month`
            : `Pay at least ${formatTaka(totalMinimum)} to advance EMIs`}
        </div>
      )}
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-neon-cyan)]"
        />
      </Field>
      <Field label="Note (optional)">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="bank transfer, autopay…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)] outline-none focus:border-[color:var(--color-neon-cyan)]"
        />
      </Field>

      <div className="rounded-xl bg-white/5 px-4 py-3 text-xs text-[color:var(--color-text-secondary)]">
        New balance:{" "}
        <span className="font-semibold text-[color:var(--color-text-primary)]">
          {formatTaka(Math.max(0, currentBalance - Math.round(parseFloat(amount || "0") * 100)))}
        </span>
      </div>

      {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

      <PrimaryButton disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Record payment"}
      </PrimaryButton>
    </ModalShell>
  );
}

/* -------------------------------------------------------------------------- */
/* EMI modal                                                                  */
/* -------------------------------------------------------------------------- */

function EmiModal({
  cardId,
  onClose,
  onSaved,
}: {
  cardId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { sessionKey } = useSessionStore();
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [tenure, setTenure] = useState("12");
  const [monthly, setMonthly] = useState("");
  const [start, setStart] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-compute monthly when principal/tenure changes (simple equal split)
  useEffect(() => {
    const p = parseFloat(principal || "0");
    const t = parseInt(tenure || "0", 10);
    if (p > 0 && t > 0) {
      setMonthly((p / t).toFixed(2));
    }
  }, [principal, tenure]);

  async function save() {
    if (!sessionKey) return;
    if (!name.trim()) return setError("Enter a name");
    const p = Math.round(parseFloat(principal || "0") * 100);
    const m = Math.round(parseFloat(monthly || "0") * 100);
    const t = parseInt(tenure, 10);
    if (p <= 0 || m <= 0 || t <= 0) {
      setError("Principal, monthly, and tenure must be positive");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/card-emis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_id: cardId,
          name_encrypted: encrypt(name.trim(), sessionKey),
          principal_encrypted: encrypt(String(p), sessionKey),
          monthly_amount_encrypted: encrypt(String(m), sessionKey),
          tenure_months: t,
          start_date: start,
        }),
      });
      if (res.ok) onSaved();
      else {
        const e = await res.json();
        setError(typeof e.error === "string" ? e.error : "Failed to add EMI");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell kicker="Installment" title="Add card EMI" onClose={onClose}>
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. iPhone 16 Pro"
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)] outline-none focus:border-[color:var(--color-neon-magenta)]"
        />
      </Field>
      <Field label="Principal (৳)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-neon-magenta)]"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tenure (months)">
          <input
            type="number"
            min="1"
            value={tenure}
            onChange={(e) => setTenure(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-neon-magenta)]"
          />
        </Field>
        <Field label="Monthly (৳)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-neon-magenta)]"
          />
        </Field>
      </div>
      <Field label="Start date">
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-neon-magenta)]"
        />
      </Field>

      {error && <p className="text-sm text-[color:var(--color-danger)]">{error}</p>}

      <PrimaryButton disabled={saving} onClick={save} accent="magenta">
        {saving ? "Saving…" : "Add EMI"}
      </PrimaryButton>
    </ModalShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared modal bits                                                          */
/* -------------------------------------------------------------------------- */

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
        background:
          "radial-gradient(ellipse at center, rgba(5,5,16,0.75), rgba(5,5,16,0.95))",
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
      <label className="block text-sm font-medium text-[color:var(--color-text-primary)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  accent = "cyan",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: "cyan" | "magenta";
}) {
  const gradient =
    accent === "magenta"
      ? "linear-gradient(135deg, #ff2bd6, #9d4dff)"
      : "linear-gradient(135deg, #00e5ff, #ff2bd6)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl py-3 font-[family-name:var(--font-mono)] text-[0.78rem] uppercase tracking-[0.18em] font-semibold text-black disabled:opacity-50"
      style={{
        background: gradient,
        boxShadow: "0 10px 30px -10px rgba(0,229,255,0.5)",
      }}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* List wrapper                                                               */
/* -------------------------------------------------------------------------- */

interface CreditCardListProps {
  cards: Card[];
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
}

export default function CreditCardPanel({ cards, onDelete, onRefresh }: CreditCardListProps) {
  if (cards.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-text-muted)] text-center py-8">
        No credit cards added yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <CreditCardPanelItem
          key={card.id}
          card={card}
          onDelete={onDelete}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
