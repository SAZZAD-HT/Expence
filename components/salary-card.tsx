"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Wallet, X } from "lucide-react";
import { decrypt, encrypt } from "@/lib/encryption";
import { createBrowserClient } from "@/lib/supabase";
import { useSessionStore } from "@/store/session.store";
import { formatTaka } from "@/lib/format";

async function getToken(): Promise<string | null> {
  const s = createBrowserClient();
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SalaryCard() {
  const { sessionKey } = useSessionStore();
  const [salary, setSalary] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const month = currentMonth();

  const load = useCallback(async () => {
    if (!sessionKey) return;
    setLoading(true);
    const token = await getToken();
    const res = await fetch(`/api/salary?month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const row = await res.json();
      if (row && row.salary_encrypted) {
        try {
          const plain = decrypt(row.salary_encrypted, sessionKey);
          setSalary(parseInt(plain, 10) || 0);
        } catch {
          setSalary(null);
        }
      } else {
        setSalary(null);
      }
    }
    setLoading(false);
  }, [sessionKey, month]);

  useEffect(() => {
    load();
  }, [load]);

  function openModal() {
    setInput(salary !== null ? String(salary / 100) : "");
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!sessionKey) return;
    const value = Math.round(parseFloat(input || "0") * 100);
    if (value <= 0) {
      setError("Enter a positive amount");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          month,
          salary_encrypted: encrypt(String(value), sessionKey),
        }),
      });
      if (res.ok) {
        setSalary(value);
        setOpen(false);
      } else {
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
    <>
      <article className="glass-card card-ticks rounded-2xl p-5 anim-rise">
        <div className="flex items-center justify-between">
          <span className="label-kicker">Monthly Income</span>
          <Wallet className="h-4 w-4 text-[color:var(--color-neon-lime)]" />
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <div
            className="font-[family-name:var(--font-mono)] font-bold text-2xl md:text-[1.75rem] leading-none"
            style={{ color: "var(--color-neon-lime)" }}
          >
            {loading ? "—" : salary !== null ? formatTaka(salary) : "Not set"}
          </div>
          <button
            onClick={openModal}
            className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:border-white/20 transition-colors font-[family-name:var(--font-mono)]"
          >
            <Pencil className="h-3 w-3" />
            {salary !== null ? "Edit" : "Set"}
          </button>
        </div>
        <p className="mt-2 font-[family-name:var(--font-mono)] text-[0.68rem] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">
          {month}
        </p>
      </article>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(5,5,16,0.75), rgba(5,5,16,0.95))",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="glass-card card-ticks rounded-3xl p-6 w-full max-w-sm space-y-4 anim-rise">
            <div className="flex items-center justify-between">
              <div>
                <span className="label-kicker">Income</span>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold">
                  Monthly Salary · {month}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-full border border-white/10 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-neon-magenta)] hover:border-[color:var(--color-neon-magenta)] transition-colors flex items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[color:var(--color-text-primary)]">
                Salary (৳)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="80000"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)] outline-none focus:border-[color:var(--color-neon-cyan)]"
                autoFocus
              />
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
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
