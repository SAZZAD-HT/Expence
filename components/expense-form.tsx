"use client";

import { useState, useEffect, type FormEvent } from "react";
import { encrypt, decrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";

interface Category {
  id: string;
  category_name_encrypted: string; // already layer-1 decrypted by server, this is layer-2 ciphertext
  segment_id: string | null;
}

interface CreditCard {
  id: string;
  card_name_encrypted: string; // layer-2 ciphertext
}

interface ExpenseFormProps {
  onSuccess?: () => void;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "debit_card", label: "Debit Card" },
  { value: "credit_card", label: "Credit Card" },
] as const;

type PaymentMethod = "cash" | "debit_card" | "credit_card";

async function getToken(): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function ExpenseForm({ onSuccess }: ExpenseFormProps) {
  const { sessionKey } = useSessionStore();
  const [amount, setAmount] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [creditCardId, setCreditCardId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [newCategorySegmentId, setNewCategorySegmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionKey) return;
    async function load() {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [catRes, cardRes, segRes] = await Promise.all([
        fetch("/api/categories", { headers }),
        fetch("/api/credit-cards", { headers }),
        fetch("/api/budget", { headers }),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (cardRes.ok) setCreditCards(await cardRes.json());
      if (segRes.ok) setSegments(await segRes.json());
    }
    load();
  }, [sessionKey]);

  function decryptField(ciphertext: string): string {
    if (!sessionKey) return ciphertext;
    try {
      return decrypt(ciphertext, sessionKey);
    } catch {
      return ciphertext;
    }
  }

  const filteredCategories = categories.filter((c) =>
    decryptField(c.category_name_encrypted)
      .toLowerCase()
      .includes(categorySearch.toLowerCase())
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sessionKey) return;

    const amountPaise = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountPaise) || amountPaise <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const token = await getToken();
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      let finalCategoryId = categoryId;

      if (showNewCategory && newCategoryName.trim()) {
        const catNameEncrypted = encrypt(newCategoryName.trim(), sessionKey);
        const catRes = await fetch("/api/categories", {
          method: "POST",
          headers,
          body: JSON.stringify({
            category_name_encrypted: catNameEncrypted,
            segment_id: newCategorySegmentId,
          }),
        });
        if (catRes.ok) {
          const newCat = await catRes.json();
          finalCategoryId = newCat.id;
        }
      }

      const body = {
        amount_encrypted: encrypt(String(amountPaise), sessionKey),
        category_id: finalCategoryId,
        payment_method: paymentMethod,
        credit_card_id: paymentMethod === "credit_card" ? creditCardId : null,
        description_encrypted: description.trim()
          ? encrypt(description.trim(), sessionKey)
          : undefined,
        expense_date: date,
      };

      const res = await fetch("/api/expenses", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Failed to save expense");
        return;
      }

      // Reset form
      setAmount("");
      setCategorySearch("");
      setCategoryId(null);
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setShowNewCategory(false);
      setNewCategoryName("");
      onSuccess?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Amount (৳)
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
          className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Category
        </label>
        {!categoryId ? (
          <div className="space-y-2">
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search categories…"
              className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
            />
            {categorySearch && (
              <div className="rounded-xl border border-white/40 bg-white/80 backdrop-blur-sm max-h-40 overflow-y-auto">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(c.id);
                        setCategorySearch(decryptField(c.category_name_encrypted));
                        setShowNewCategory(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-white/60 transition-colors"
                    >
                      {decryptField(c.category_name_encrypted)}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategory(true);
                      setNewCategoryName(categorySearch);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-500 hover:bg-white/60"
                  >
                    + Create &quot;{categorySearch}&quot;
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex-1 rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-sm text-slate-700">
              {categorySearch}
            </span>
            <button
              type="button"
              onClick={() => {
                setCategoryId(null);
                setCategorySearch("");
              }}
              className="text-slate-400 hover:text-slate-600 text-sm px-2"
            >
              ✕
            </button>
          </div>
        )}

        {showNewCategory && (
          <div className="space-y-2 rounded-xl border border-white/40 bg-white/50 p-3">
            <p className="text-xs text-slate-500 font-medium">New category</p>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              className="w-full rounded-lg border border-white/40 bg-white/50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
            />
            <select
              value={newCategorySegmentId ?? ""}
              onChange={(e) =>
                setNewCategorySegmentId(e.target.value || null)
              }
              className="w-full rounded-lg border border-white/40 bg-white/50 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">No segment</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Date */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* Payment Method */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Payment Method
        </label>
        <div className="flex gap-2">
          {PAYMENT_METHODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPaymentMethod(value)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
                paymentMethod === value
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:bg-white/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Card Selector */}
      {paymentMethod === "credit_card" && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">
            Credit Card
          </label>
          <select
            value={creditCardId ?? ""}
            onChange={(e) => setCreditCardId(e.target.value || null)}
            className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">Select card</option>
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>
                {decryptField(c.card_name_encrypted)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700">
          Description{" "}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional note"
          className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-white py-3 font-medium text-slate-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
      >
        {loading ? "Saving…" : "Add Expense"}
      </button>
    </form>
  );
}
