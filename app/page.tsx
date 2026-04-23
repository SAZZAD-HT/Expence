"use client";

import { useState, FormEvent } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/verify-access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        window.location.href = "/login";
        return;
      }

      if (res.status === 401) {
        setError("Invalid access code");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-800 text-center">
            Expense Manager
          </h1>
          <p className="text-sm text-slate-500 text-center">
            Your private financial dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter access code"
            autoComplete="current-password"
            className="w-full rounded-xl border border-white/40 bg-white/50 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-300 backdrop-blur-sm"
          />

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length === 0}
            className="w-full rounded-xl bg-white py-3 font-medium text-slate-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
