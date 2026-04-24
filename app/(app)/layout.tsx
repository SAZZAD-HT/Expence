"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Landmark,
  CreditCard,
  BarChart3,
  Lock,
  LogOut,
  PiggyBank,
  ShoppingBag,
  Banknote,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import { useSessionStore } from "@/store/session.store";
import SessionKeyModal from "@/components/session-key-modal";
import ModeToggle from "@/components/mode-toggle";

const navItems = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/dashboard/expenses", label: "Expenses", Icon: Receipt },
  { href: "/dashboard/budget", label: "Budget", Icon: PieChart },
  { href: "/dashboard/loans", label: "Loans", Icon: Landmark },
  { href: "/dashboard/credit-cards", label: "Cards", Icon: CreditCard },
  { href: "/dashboard/cash", label: "Cash", Icon: Banknote },
  { href: "/dashboard/savings", label: "Savings", Icon: PiggyBank },
  { href: "/dashboard/procurement", label: "Wishlist", Icon: ShoppingBag },
  { href: "/dashboard/reports", label: "Reports", Icon: BarChart3 },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isUnlocked, clearSessionKey } = useSessionStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    clearSessionKey();
    router.push("/login");
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-[color:var(--color-neon-cyan)]/40 border-t-[color:var(--color-neon-cyan)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen text-[color:var(--color-text-primary)]">
      {/* Desktop Sidebar */}
      <aside className="app-sidebar hidden lg:flex flex-col w-64 m-4 p-5 glass-card rounded-2xl sticky top-4 h-[calc(100vh-2rem)] self-start shrink-0">
        <div className="mb-8 px-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--color-neon-magenta)] anim-pulse-glow"
              style={{ boxShadow: "0 0 12px #ff2bd6" }}
            />
            <span className="label-kicker">সাইফার / CIPHER</span>
          </div>
          <h1
            className="mt-2 font-[family-name:var(--font-display)] text-[1.35rem] font-extrabold uppercase leading-none anim-flicker"
            style={{
              background: "linear-gradient(92deg, #00e5ff 0%, #ff2bd6 60%, #9d4dff 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            Night Market
          </h1>
          <p className="mt-1 font-[family-name:var(--font-mono)] text-[0.66rem] tracking-[0.2em] uppercase text-[color:var(--color-text-muted)]">
            Encrypted · Private · Yours
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`group relative flex items-center gap-3 rounded-lg pl-4 pr-3 py-2.5 text-[0.82rem] uppercase tracking-[0.14em] transition-all duration-200 ${
                  active
                    ? "nav-active font-semibold"
                    : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] hover:bg-white/[.03]"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    active ? "text-[color:var(--color-neon-cyan)]" : "text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-neon-cyan)]"
                  }`}
                />
                <span className="font-[family-name:var(--font-mono)]">{label}</span>
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--color-neon-cyan)]" style={{ boxShadow: "0 0 10px #00e5ff" }} />
                )}
              </Link>
            );
          })}
        </nav>

        <hr className="hr-dashed my-4" />
        <div className="space-y-1">
          <ModeToggle />
          <button
            onClick={() => clearSessionKey()}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[0.78rem] uppercase tracking-[0.14em] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-neon-magenta)] hover:bg-white/[.03] transition-colors"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="font-[family-name:var(--font-mono)]">Lock Session</span>
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[0.78rem] uppercase tracking-[0.14em] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-danger)] hover:bg-white/[.03] transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="font-[family-name:var(--font-mono)]">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        {/* Paper-mode top bar — only rendered when .mode-paper is on html */}
        <header className="app-topbar">
          <span className="font-[family-name:var(--font-mono)] text-[0.72rem] tracking-[0.22em] uppercase text-slate-900">
            Night Market
          </span>
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {navItems.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] transition-colors ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-auto">
              <ModeToggle />
            </div>
            <button
              onClick={() => clearSessionKey()}
              className="px-3 py-1.5 rounded-md text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              Lock
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-md text-[0.72rem] uppercase tracking-[0.14em] font-[family-name:var(--font-mono)] text-slate-600 hover:text-red-600 hover:bg-slate-100"
            >
              Sign Out
            </button>
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 glass-card rounded-2xl px-2 py-2 z-40">
        <div className="flex justify-around">
          {navItems.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  active
                    ? "text-[color:var(--color-neon-cyan)]"
                    : "text-[color:var(--color-text-muted)]"
                }`}
                style={active ? { textShadow: "0 0 10px #00e5ff" } : undefined}
              >
                <Icon className="h-4.5 w-4.5" />
                <span className="text-[9px] font-[family-name:var(--font-mono)] uppercase tracking-[0.15em]">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Session key gate */}
      {!isUnlocked && <SessionKeyModal />}
    </div>
  );
}
