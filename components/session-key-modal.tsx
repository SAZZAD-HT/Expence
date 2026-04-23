"use client";

import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { useSessionStore } from "@/store/session.store";

export default function SessionKeyModal() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setSessionKey = useSessionStore((s) => s.setSessionKey);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (key.length < 8) {
      setError("Key must be at least 8 characters");
      return;
    }
    setSessionKey(key);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(5,5,16,0.85), rgba(5,5,16,0.98))",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="hero-card card-ticks rounded-3xl p-8 w-full max-w-md space-y-6 anim-rise">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--color-neon-magenta)]/40"
            style={{
              background: "radial-gradient(circle at 50% 40%, rgba(255,43,214,0.25), transparent 70%)",
              boxShadow: "0 0 40px -5px rgba(255,43,214,0.5)",
            }}
          >
            <KeyRound className="h-6 w-6 text-[color:var(--color-neon-magenta)] anim-pulse-glow" />
          </div>
          <span className="label-kicker block">Stage 02 · Personal Cipher</span>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-white">
            Unlock the Vault
          </h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] font-[family-name:var(--font-body)]">
            Your session key is the second layer. It lives only in this tab&rsquo;s memory.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setError(null);
            }}
            placeholder="••••••••"
            autoComplete="off"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 font-[family-name:var(--font-mono)] text-white placeholder-[color:var(--color-text-muted)] tracking-widest outline-none focus:border-[color:var(--color-neon-cyan)] focus:ring-2 focus:ring-[color:var(--color-neon-cyan)]/30 transition-all"
          />

          {error && (
            <p className="text-sm text-[color:var(--color-danger)] text-center font-[family-name:var(--font-mono)] uppercase tracking-[0.15em]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={key.length === 0}
            className="w-full rounded-xl py-3.5 font-[family-name:var(--font-mono)] text-sm uppercase tracking-[0.2em] text-black font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
            style={{
              background: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
              boxShadow: "0 10px 40px -10px rgba(0,229,255,0.6), 0 20px 60px -20px rgba(255,43,214,0.5)",
            }}
          >
            Unlock
          </button>
        </form>

        <p className="text-[0.68rem] text-[color:var(--color-text-muted)] text-center font-[family-name:var(--font-mono)] uppercase tracking-[0.18em]">
          Key never stored · Memory only
        </p>
      </div>
    </div>
  );
}
