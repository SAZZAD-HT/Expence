"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { encrypt } from "@/lib/encryption";
import { calculateEMI } from "@/lib/loan-math";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import LoanCalculator from "@/components/loan-calculator";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface LoanRow {
  id: string;
  loan_name_encrypted: string;
  principal_encrypted: string;
  interest_rate_encrypted: string;
  start_date: string;
  tenure_months: number;
  emi_amount_encrypted: string;
  segment_id: string | null;
}

interface SegmentRow {
  id: string;
  name: string;
}

export default function LoansPage() {
  const { sessionKey } = useSessionStore();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [loanName, setLoanName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [tenure, setTenure] = useState("");
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const [loanRes, segRes] = await Promise.all([
      fetch("/api/loans", { headers: h }),
      fetch("/api/budget", { headers: h }),
    ]);
    if (loanRes.ok) setLoans(await loanRes.json());
    if (segRes.ok) setSegments(await segRes.json());
    setLoading(false);
  }, [sessionKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-calculate EMI preview
  const principalPaise = Math.round(parseFloat(principal || "0") * 100);
  const rateVal = parseFloat(rate || "0");
  const tenureVal = parseInt(tenure || "0", 10);
  const emiPreview =
    principalPaise > 0 && rateVal >= 0 && tenureVal > 0
      ? calculateEMI(principalPaise, rateVal, tenureVal)
      : 0;

  async function handleAdd() {
    if (!sessionKey) return;
    if (!loanName.trim() || !principal || !tenure || !startDate) {
      setError("Fill in all required fields");
      return;
    }
    if (principalPaise <= 0 || tenureVal <= 0) {
      setError("Invalid principal or tenure");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          loan_name_encrypted: encrypt(loanName.trim(), sessionKey),
          principal_encrypted: encrypt(String(principalPaise), sessionKey),
          interest_rate_encrypted: encrypt(String(rateVal), sessionKey),
          start_date: startDate,
          tenure_months: tenureVal,
          emi_amount_encrypted: encrypt(String(emiPreview), sessionKey),
          segment_id: segmentId,
        }),
      });
      if (res.ok) {
        setLoanName("");
        setPrincipal("");
        setRate("");
        setTenure("");
        setSegmentId(null);
        setShowAddForm(false);
        await load();
      } else {
        const e = await res.json();
        setError(e.error ?? "Failed to add loan");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`/api/loans?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoans((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Loans</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Loan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      ) : (
        <LoanCalculator
          loans={loans}
          monthlySalaryPaise={0}
          onDelete={handleDelete}
        />
      )}

      {/* Add Loan Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-white/30 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Add Loan</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {[
              {
                label: "Loan name",
                node: (
                  <input
                    type="text"
                    value={loanName}
                    onChange={(e) => setLoanName(e.target.value)}
                    placeholder="e.g. Home Loan"
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Principal (৳)",
                node: (
                  <input
                    type="number"
                    min="1"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    placeholder="500000"
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Annual interest rate (%)",
                node: (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="8.5"
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Start date",
                node: (
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
                  />
                ),
              },
              {
                label: "Tenure (months)",
                node: (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={tenure}
                    onChange={(e) => setTenure(e.target.value)}
                    placeholder="24"
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

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Segment{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select
                value={segmentId ?? ""}
                onChange={(e) => setSegmentId(e.target.value || null)}
                className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">None</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {emiPreview > 0 && (
              <div className="rounded-xl bg-white/40 px-4 py-3 text-sm text-slate-700">
                Monthly EMI:{" "}
                <span className="font-semibold">
                  ৳{(emiPreview / 100).toLocaleString("en-BD", { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full rounded-xl bg-white py-3 font-medium text-slate-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Loan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
