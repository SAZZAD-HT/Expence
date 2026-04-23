"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { encrypt } from "@/lib/encryption";
import { calculateMinimumDue } from "@/lib/credit-card-math";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import CreditCardPanel from "@/components/credit-card-panel";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface CardRow {
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

export default function CreditCardsPage() {
  const { sessionKey } = useSessionStore();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [cardName, setCardName] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [billingDay, setBillingDay] = useState("15");
  const [intFreeDays, setIntFreeDays] = useState("45");
  const [balance, setBalance] = useState("0");
  const [emiCount, setEmiCount] = useState("0");
  const [emiAmount, setEmiAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const res = await fetch("/api/credit-cards", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setCards(await res.json());
    setLoading(false);
  }, [sessionKey]);

  useEffect(() => {
    load();
  }, [load]);

  const balancePaise = Math.round(parseFloat(balance || "0") * 100);
  const minDuePreview = balancePaise > 0 ? calculateMinimumDue(balancePaise) : 0;

  async function handleAdd() {
    if (!sessionKey || !cardName.trim()) return;
    const limitPaise = Math.round(parseFloat(creditLimit || "0") * 100);
    if (limitPaise <= 0) {
      setError("Enter a valid credit limit");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const emiAmountPaise = emiAmount
        ? Math.round(parseFloat(emiAmount) * 100)
        : 0;
      const res = await fetch("/api/credit-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          card_name_encrypted: encrypt(cardName.trim(), sessionKey),
          credit_limit_encrypted: encrypt(String(limitPaise), sessionKey),
          billing_cycle_day: parseInt(billingDay, 10) || 15,
          interest_free_days: parseInt(intFreeDays, 10) || 45,
          current_balance_encrypted: encrypt(String(balancePaise), sessionKey),
          minimum_due_encrypted: encrypt(String(minDuePreview), sessionKey),
          existing_emi_count: parseInt(emiCount, 10) || 0,
          existing_emi_amount_encrypted:
            emiAmountPaise > 0
              ? encrypt(String(emiAmountPaise), sessionKey)
              : undefined,
        }),
      });
      if (res.ok) {
        setCardName("");
        setCreditLimit("");
        setBillingDay("15");
        setIntFreeDays("45");
        setBalance("0");
        setEmiCount("0");
        setEmiAmount("");
        setShowAddForm(false);
        await load();
      } else {
        const e = await res.json();
        setError(e.error ?? "Failed to add card");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`/api/credit-cards?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Credit Cards</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Card
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      ) : (
        <CreditCardPanel cards={cards} onDelete={handleDelete} />
      )}

      {/* Add Card Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-white/30 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Add Credit Card
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {[
              {
                label: "Card name",
                node: (
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="e.g. HDFC Regalia"
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Credit limit (৳)",
                node: (
                  <input
                    type="number"
                    min="1"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="100000"
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Billing cycle day (1–31)",
                node: (
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={billingDay}
                    onChange={(e) => setBillingDay(e.target.value)}
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Interest-free days",
                node: (
                  <input
                    type="number"
                    min="1"
                    value={intFreeDays}
                    onChange={(e) => setIntFreeDays(e.target.value)}
                    placeholder="45"
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Current balance (৳)",
                node: (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Existing EMI count",
                node: (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={emiCount}
                    onChange={(e) => setEmiCount(e.target.value)}
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Existing monthly EMI amount (৳, optional)",
                node: (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={emiAmount}
                    onChange={(e) => setEmiAmount(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
            ].map(({ label, node }) => (
              <div key={label} className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {label}
                </label>
                {node}
              </div>
            ))}

            {minDuePreview > 0 && (
              <div className="rounded-xl bg-white/40 px-4 py-3 text-sm text-slate-700">
                Minimum due:{" "}
                <span className="font-semibold">
                  ৳{(minDuePreview / 100).toLocaleString("en-BD", { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full rounded-xl bg-white py-3 font-medium text-slate-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Card"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
