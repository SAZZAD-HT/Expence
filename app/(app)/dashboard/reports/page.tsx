"use client";

import { useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";
import { decrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import { totalInterest, monthsRemaining } from "@/lib/loan-math";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

type ReportType = "monthly" | "over-budget" | "loans" | "credit-cards";

interface ExpenseRow {
  id: string;
  amount_encrypted: string;
  category_id: string | null;
  payment_method: string;
  description_encrypted: string | null;
  expense_date: string;
}

interface CategoryRow {
  id: string;
  category_name_encrypted: string;
  segment_id: string | null;
}

interface SegmentRow {
  id: string;
  name: string;
  monthly_limit_encrypted: string;
}

interface LoanRow {
  id: string;
  loan_name_encrypted: string;
  principal_encrypted: string;
  interest_rate_encrypted: string;
  start_date: string;
  tenure_months: number;
  emi_amount_encrypted: string;
}

interface CardRow {
  id: string;
  card_name_encrypted: string;
  credit_limit_encrypted: string;
  current_balance_encrypted: string;
  minimum_due_encrypted: string;
}

import { formatTaka } from "@/lib/format";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const REPORT_TABS: { value: ReportType; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "over-budget", label: "Over Budget" },
  { value: "loans", label: "Loans" },
  { value: "credit-cards", label: "Credit Cards" },
];

export default function ReportsPage() {
  const { sessionKey } = useSessionStore();
  const [activeTab, setActiveTab] = useState<ReportType>("monthly");
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };

    if (activeTab === "monthly" || activeTab === "over-budget") {
      const res = await fetch(`/api/reports?month=${month}&type=monthly`, { headers: h });
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses ?? []);
        setCategories(data.categories ?? []);
        setSegments(data.segments ?? []);
      }
    } else if (activeTab === "loans") {
      const res = await fetch(`/api/reports?month=${month}&type=loans`, { headers: h });
      if (res.ok) {
        const data = await res.json();
        setLoans(data.loans ?? []);
      }
    } else if (activeTab === "credit-cards") {
      const res = await fetch(`/api/reports?month=${month}&type=credit-cards`, { headers: h });
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards ?? []);
      }
    }

    setLoading(false);
  }, [sessionKey, activeTab, month]);

  useEffect(() => {
    load();
  }, [load]);

  if (!sessionKey) return null;

  function dec(c: string): number {
    try {
      return parseInt(decrypt(c, sessionKey!), 10) || 0;
    } catch {
      return 0;
    }
  }

  function decStr(c: string): string {
    try {
      return decrypt(c, sessionKey!);
    } catch {
      return c;
    }
  }

  const catMap = new Map<string, CategoryRow>(categories.map((c) => [c.id, c]));
  const segMap = new Map<string, SegmentRow>(segments.map((s) => [s.id, s]));

  function exportCSV() {
    const rows = [
      ["Date", "Category", "Segment", "Amount", "Payment Method", "Description"],
      ...expenses.map((e) => {
        const cat = e.category_id ? catMap.get(e.category_id) : undefined;
        const seg = cat?.segment_id ? segMap.get(cat.segment_id) : undefined;
        return [
          e.expense_date,
          cat ? decStr(cat.category_name_encrypted) : "Uncategorized",
          seg?.name ?? "-",
          (dec(e.amount_encrypted) / 100).toFixed(2),
          e.payment_method,
          e.description_encrypted ? decStr(e.description_encrypted) : "",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Over-budget calculation
  const segSpent = new Map<string, number>();
  expenses.forEach((e) => {
    const cat = e.category_id ? catMap.get(e.category_id) : undefined;
    const segId = cat?.segment_id;
    if (segId) {
      segSpent.set(segId, (segSpent.get(segId) ?? 0) + dec(e.amount_encrypted));
    }
  });
  const overBudgetSegs = segments.filter((s) => {
    const limit = dec(s.monthly_limit_encrypted);
    const spent = segSpent.get(s.id) ?? 0;
    return spent > limit && limit > 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Reports</h1>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-300"
          />
          {(activeTab === "monthly" || activeTab === "over-budget") && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:shadow-md transition-all"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card rounded-xl p-1">
        {REPORT_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              activeTab === t.value
                ? "bg-white shadow-sm text-slate-800"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      ) : (
        <>
          {/* Monthly Report */}
          {activeTab === "monthly" && (
            <div className="glass-card rounded-xl overflow-hidden">
              {expenses.length === 0 ? (
                <p className="text-sm text-slate-400 text-center p-8">
                  No expenses for {month}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/40 text-xs text-slate-400 uppercase tracking-wide">
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Category</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Segment</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Method</th>
                      <th className="text-right px-4 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {expenses.map((e) => {
                      const cat = e.category_id ? catMap.get(e.category_id) : undefined;
                      const seg = cat?.segment_id ? segMap.get(cat.segment_id) : undefined;
                      return (
                        <tr key={e.id} className="hover:bg-white/20 transition-colors">
                          <td className="px-4 py-3 text-slate-500">{e.expense_date}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">
                            {cat ? decStr(cat.category_name_encrypted) : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                            {seg?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500 capitalize hidden sm:table-cell">
                            {e.payment_method.replace("_", " ")}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatTaka(dec(e.amount_encrypted))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/40">
                      <td colSpan={4} className="px-4 py-3 text-sm font-medium text-slate-600">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatTaka(
                          expenses.reduce((s, e) => s + dec(e.amount_encrypted), 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}

          {/* Over Budget Report */}
          {activeTab === "over-budget" && (
            <div className="space-y-3">
              {overBudgetSegs.length === 0 ? (
                <div className="glass-card rounded-xl p-8 text-center text-sm text-[#34d399]">
                  All segments within budget for {month}
                </div>
              ) : (
                overBudgetSegs.map((seg) => {
                  const limit = dec(seg.monthly_limit_encrypted);
                  const spent = segSpent.get(seg.id) ?? 0;
                  const over = spent - limit;
                  const pct = ((spent / limit) * 100).toFixed(0);
                  return (
                    <div key={seg.id} className="glass-card rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">
                          {seg.name}
                        </h3>
                        <span className="text-xs text-[#f87171] font-medium">
                          {pct}% of budget
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-400">Limit</p>
                          <p className="font-semibold text-slate-700">{formatTaka(limit)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Spent</p>
                          <p className="font-semibold text-slate-700">{formatTaka(spent)}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Over by</p>
                          <p className="font-semibold text-[#f87171]">{formatTaka(over)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Loans Report */}
          {activeTab === "loans" && (
            <div className="space-y-3">
              {loans.length === 0 ? (
                <div className="glass-card rounded-xl p-8 text-center text-sm text-slate-400">
                  No loans recorded
                </div>
              ) : (
                <>
                  {loans.map((loan) => {
                    const principal = dec(loan.principal_encrypted);
                    const rate = parseFloat(decStr(loan.interest_rate_encrypted)) || 0;
                    const emi = dec(loan.emi_amount_encrypted);
                    const totalInt = totalInterest(principal, rate, loan.tenure_months);
                    const monthsLeft = monthsRemaining(loan.start_date, loan.tenure_months);
                    return (
                      <div key={loan.id} className="glass-card rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            {decStr(loan.loan_name_encrypted)}
                          </h3>
                          <span className="text-xs text-slate-400">
                            {monthsLeft} months left
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-slate-400">EMI</p>
                            <p className="font-semibold text-slate-700">{formatTaka(emi)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Total Interest</p>
                            <p className="font-semibold text-slate-700">{formatTaka(totalInt)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Rate</p>
                            <p className="font-semibold text-slate-700">{rate}% p.a.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="glass-card rounded-xl p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total monthly EMI burden</span>
                      <span className="font-semibold text-slate-800">
                        {formatTaka(loans.reduce((s, l) => s + dec(l.emi_amount_encrypted), 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Credit Cards Report */}
          {activeTab === "credit-cards" && (
            <div className="space-y-3">
              {cards.length === 0 ? (
                <div className="glass-card rounded-xl p-8 text-center text-sm text-slate-400">
                  No credit cards recorded
                </div>
              ) : (
                <>
                  {cards.map((card) => {
                    const limit = dec(card.credit_limit_encrypted);
                    const balance = dec(card.current_balance_encrypted);
                    const minDue = dec(card.minimum_due_encrypted);
                    const used = limit > 0 ? ((balance / limit) * 100).toFixed(0) : "0";
                    return (
                      <div key={card.id} className="glass-card rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            {decStr(card.card_name_encrypted)}
                          </h3>
                          <span className="text-xs text-slate-400">{used}% used</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-slate-400">Balance</p>
                            <p className="font-semibold text-slate-700">{formatTaka(balance)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Limit</p>
                            <p className="font-semibold text-slate-700">{formatTaka(limit)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Min Due</p>
                            <p className="font-semibold text-[#fbbf24]">{formatTaka(minDue)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="glass-card rounded-xl p-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total minimum due</span>
                      <span className="font-semibold text-slate-800">
                        {formatTaka(cards.reduce((s, c) => s + dec(c.minimum_due_encrypted), 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
