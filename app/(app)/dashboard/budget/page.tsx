"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { encrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";
import { createBrowserClient } from "@/lib/supabase";
import BudgetProgress from "@/components/budget-progress";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

interface SegmentRow {
  id: string;
  name: string;
  monthly_limit_encrypted: string;
  color_tag: string | null;
  is_fixed_cost: boolean;
}

interface ExpenseRow {
  category_id: string | null;
  amount_encrypted: string;
}

interface CategoryRow {
  id: string;
  segment_id: string | null;
}

const COLOR_OPTIONS = [
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#fb923c",
];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetPage() {
  const { sessionKey } = useSessionStore();
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // New segment form
  const [name, setName] = useState("");
  const [limitRupees, setLimitRupees] = useState("");
  const [colorTag, setColorTag] = useState(COLOR_OPTIONS[0]);
  const [isFixed, setIsFixed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const h = { Authorization: `Bearer ${token}` };
    const month = currentMonth();
    const [segRes, expRes, catRes] = await Promise.all([
      fetch("/api/budget", { headers: h }),
      fetch(`/api/expenses?month=${month}`, { headers: h }),
      fetch("/api/categories", { headers: h }),
    ]);
    if (segRes.ok) setSegments(await segRes.json());
    if (expRes.ok) setExpenses(await expRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    setLoading(false);
  }, [sessionKey]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddSegment() {
    if (!sessionKey || !name.trim() || !limitRupees) return;
    const limitPaise = Math.round(parseFloat(limitRupees) * 100);
    if (isNaN(limitPaise) || limitPaise <= 0) {
      setError("Enter a valid limit");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          monthly_limit_encrypted: encrypt(String(limitPaise), sessionKey),
          color_tag: colorTag,
          is_fixed_cost: isFixed,
        }),
      });
      if (res.ok) {
        setName("");
        setLimitRupees("");
        setIsFixed(false);
        setShowAddForm(false);
        await load();
      } else {
        const e = await res.json();
        setError(e.error ?? "Failed to add segment");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    await fetch(`/api/budget?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Budget</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Segment
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <BudgetProgress
            segments={segments}
            expenses={expenses}
            categories={categories}
          />

          {segments.length > 0 && (
            <div className="glass-card rounded-xl divide-y divide-white/40 overflow-hidden">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    {seg.color_tag && (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: seg.color_tag }}
                      />
                    )}
                    <span className="text-sm text-slate-700">{seg.name}</span>
                    {seg.is_fixed_cost && (
                      <span className="text-xs text-slate-400">Fixed</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(seg.id)}
                    className="text-xs text-slate-300 hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Segment Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-white/30 p-4">
          <div className="glass-card rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                New Budget Segment
              </h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Segment name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Food, Transport, Fixed Costs"
                className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Monthly limit (৳)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={limitRupees}
                onChange={(e) => setLimitRupees(e.target.value)}
                placeholder="5000"
                className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                Color
              </label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorTag(c)}
                    className={`h-7 w-7 rounded-full transition-all ${colorTag === c ? "ring-2 ring-slate-400 ring-offset-2" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFixed}
                onChange={(e) => setIsFixed(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">
                Fixed cost (recurring monthly)
              </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleAddSegment}
              disabled={saving || !name.trim() || !limitRupees}
              className="w-full rounded-xl bg-white py-3 font-medium text-slate-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Segment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
