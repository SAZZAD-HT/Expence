"use client";

import { decrypt } from "@/lib/encryption";
import { useSessionStore } from "@/store/session.store";

interface BudgetSegment {
  id: string;
  name: string;
  monthly_limit_encrypted: string; // layer-2 ciphertext (layer-1 already stripped by API)
  color_tag: string | null;
  is_fixed_cost: boolean;
}

interface ExpenseRow {
  category_id: string | null;
  amount_encrypted: string; // layer-2 ciphertext
}

interface CategoryRow {
  id: string;
  segment_id: string | null;
}

interface BudgetProgressProps {
  segments: BudgetSegment[];
  expenses: ExpenseRow[];
  categories: CategoryRow[];
}

import { formatTaka } from "@/lib/format";

export default function BudgetProgress({
  segments,
  expenses,
  categories,
}: BudgetProgressProps) {
  const { sessionKey } = useSessionStore();

  if (!sessionKey) {
    return (
      <div className="text-sm text-slate-400 text-center py-8">
        Locked
      </div>
    );
  }

  function decryptPaise(ciphertext: string): number {
    try {
      return parseInt(decrypt(ciphertext, sessionKey!), 10) || 0;
    } catch {
      return 0;
    }
  }

  const categorySegmentMap = new Map<string, string | null>(
    categories.map((c) => [c.id, c.segment_id])
  );

  const spentBySegment = new Map<string, number>();
  for (const exp of expenses) {
    const segId = exp.category_id
      ? (categorySegmentMap.get(exp.category_id) ?? null)
      : null;
    if (segId) {
      const current = spentBySegment.get(segId) ?? 0;
      spentBySegment.set(segId, current + decryptPaise(exp.amount_encrypted));
    }
  }

  return (
    <div className="space-y-4">
      {segments.map((seg) => {
        const limit = decryptPaise(seg.monthly_limit_encrypted);
        const spent = spentBySegment.get(seg.id) ?? 0;
        const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
        const overBudget = spent > limit && limit > 0;

        let barColor = "bg-[#34d399]";
        if (pct >= 90) barColor = "bg-[#f87171]";
        else if (pct >= 70) barColor = "bg-[#fbbf24]";

        return (
          <div key={seg.id} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {seg.color_tag && (
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color_tag }}
                  />
                )}
                <span className="text-sm font-medium text-slate-700">
                  {seg.name}
                  {seg.is_fixed_cost && (
                    <span className="ml-1.5 text-xs text-slate-400 font-normal">
                      Fixed
                    </span>
                  )}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {formatTaka(spent)} / {formatTaka(limit)}
              </span>
            </div>

            <div className="h-2 rounded-full bg-slate-200/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {overBudget && (
              <p className="text-xs text-[#f87171] font-medium">
                Over budget by {formatTaka(spent - limit)}
              </p>
            )}
          </div>
        );
      })}

      {segments.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-8">
          No budget segments yet. Add one to start tracking.
        </p>
      )}
    </div>
  );
}
