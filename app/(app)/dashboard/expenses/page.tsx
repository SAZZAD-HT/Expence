"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { decrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import ExpenseForm from "@/components/expense-form";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface ExpenseRow {
  id: string;
  amount_encrypted: string;
  category_id: string | null;
  payment_method: string;
  credit_card_id: string | null;
  description_encrypted: string | null;
  expense_date: string;
  created_at: string;
}

interface CategoryRow {
  id: string;
  category_name_encrypted: string;
}

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-[#34d399]/20 text-[#059669]",
  debit_card: "bg-blue-100/60 text-blue-600",
  credit_card: "bg-[#fbbf24]/20 text-amber-600",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  debit_card: "Debit",
  credit_card: "Credit",
};

import { formatTaka } from "@/lib/format";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupByDate(expenses: ExpenseRow[]) {
  const map = new Map<string, ExpenseRow[]>();
  for (const e of expenses) {
    const list = map.get(e.expense_date) ?? [];
    list.push(e);
    map.set(e.expense_date, list);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function ExpensesPage() {
  const { sessionKey } = useSessionStore();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const [expRes, catRes] = await Promise.all([
      fetch(`/api/expenses?month=${month}`, { headers: h }),
      fetch("/api/categories", { headers: h }),
    ]);
    if (expRes.ok) setExpenses(await expRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  }, [sessionKey, month]);

  useEffect(() => {
    load();
  }, [load]);

  function dec(c: string): number {
    if (!sessionKey) return 0;
    try {
      return parseInt(decrypt(c, sessionKey), 10) || 0;
    } catch {
      return 0;
    }
  }

  function decStr(c: string): string {
    if (!sessionKey) return "";
    try {
      return decrypt(c, sessionKey);
    } catch {
      return "";
    }
  }

  const catMap = new Map<string, string>(
    categories.map((c) => [c.id, decStr(c.category_name_encrypted)])
  );

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`/api/expenses?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  const totalThisMonth = expenses.reduce((s, e) => s + dec(e.amount_encrypted), 0);
  const grouped = groupByDate(expenses);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Expenses</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Total: {formatTaka(totalThisMonth)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-sm text-slate-400">
          No expenses recorded this month.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, rows]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </h3>
                <span className="text-xs text-slate-400">
                  {formatTaka(
                    rows.reduce((s, r) => s + dec(r.amount_encrypted), 0)
                  )}
                </span>
              </div>
              <div className="glass-card rounded-xl overflow-hidden divide-y divide-white/40">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {row.category_id
                          ? (catMap.get(row.category_id) ?? "Uncategorized")
                          : "Uncategorized"}
                      </p>
                      {row.description_encrypted && (
                        <p className="text-xs text-slate-400 truncate">
                          {decStr(row.description_encrypted)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${METHOD_COLORS[row.payment_method] ?? ""}`}
                    >
                      {METHOD_LABELS[row.payment_method] ?? row.payment_method}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 shrink-0">
                      {formatTaka(dec(row.amount_encrypted))}
                    </span>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-white/30 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Add Expense
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
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
