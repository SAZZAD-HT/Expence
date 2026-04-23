# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal Expense Management web app — private-by-design, deployed on Vercel with Supabase backend. Full spec: `docs/superpowers/specs/2026-04-18-expense-manager-spec.md`. Build checklist: `BUILD_INSTRUCTIONS.md`.

**Status:** Steps 1–14 complete (scaffolding, auth, encryption, expenses, budget, loans, credit cards, dashboard, reports, admin). Remaining: README, E2E encryption round-trip test, Vercel deploy. See `BUILD_INSTRUCTIONS.md`.

## Tech Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict mode)
- Supabase (PostgreSQL + Auth + RLS), Prisma ORM
- Tailwind CSS 4 + shadcn/ui + Base UI (`@base-ui/react`)
- crypto-js (AES-256), bcryptjs
- Zustand 5 (session state only), Recharts, React Hook Form, Zod 4

## Commands

Once scaffolded:
```bash
npm run dev       # start dev server
npm run build     # production build
npm run lint      # ESLint
```

Supabase migrations live in `/supabase/migrations/` (authoritative SQL incl. RLS policies) — run them via the Supabase dashboard SQL editor or `supabase db push`.

### Database: Prisma + Supabase split
Prisma is the app-level ORM; Supabase hosts Postgres + Auth + RLS.
- `prisma/schema.prisma` mirrors the tables defined by `supabase/migrations/*.sql` and generates the typed client used in API routes via `lib/prisma.ts`.
- Two connection strings in `.env.local`:
  - `DATABASE_URL` — pgbouncer pooled (port 6543) — used at runtime by the app.
  - `DIRECT_URL` — direct (port 5432) — used only by `prisma migrate` / introspection.
- `npx prisma generate` after schema changes; `npx prisma db pull` to re-sync from Supabase-owned DDL.

### Scripts
- `scripts/rotate-key.ts` — rotates `MASTER_ENCRYPTION_KEY` by re-encrypting all Layer-1 ciphertext. Run manually; not part of the build.

## Architecture

### Two-Layer Encryption
All sensitive DB fields are double-encrypted:
1. **Layer 1 (admin/program):** `MASTER_ENCRYPTION_KEY` env var — applied at the API route level before writing to Supabase
2. **Layer 2 (user session):** Personal key entered by the user on dashboard entry — lives only in Zustand memory, never persisted anywhere

Data flow: `User input → Zod validate → Layer 2 encrypt (session key) → POST API route → Layer 1 encrypt (master key) → Supabase`

Reverse on read: `Supabase → Layer 1 decrypt (server) → send to client → Layer 2 decrypt (session key in memory) → display`

### Key Constraints
- **Session key: NEVER store** in localStorage, sessionStorage, cookies, or DB — Zustand memory only, cleared on tab close / logout
- **No direct Supabase client calls** from the browser — all queries go through Next.js API routes
- **RLS on all tables:** `WHERE user_id = auth.uid()`
- **No `any` TypeScript types**
- **Money as integers (poisha, 1/100 ৳)** — never floats. All display goes through `lib/format.ts` (`formatTaka`)
- **Currency: BDT (৳)** — locale `en-BD`. Don't reintroduce `₹` / `INR` / `en-IN`
- **Dates as ISO strings** (YYYY-MM-DD)

### Route → File Mapping
```
/                          → app/page.tsx
/login                     → app/(auth)/login/page.tsx
/dashboard                 → app/(app)/dashboard/page.tsx
/dashboard/expenses        → app/(app)/dashboard/expenses/page.tsx
/dashboard/budget          → app/(app)/dashboard/budget/page.tsx
/dashboard/loans           → app/(app)/dashboard/loans/page.tsx
/dashboard/credit-cards    → app/(app)/dashboard/credit-cards/page.tsx
/dashboard/reports         → app/(app)/dashboard/reports/page.tsx
/admin                     → app/admin/page.tsx (gated to ADMIN_EMAIL)
```

### Key Library Files
- `lib/encryption.ts` — `encrypt()` / `decrypt()` helpers (AES-256)
- `lib/supabase.ts` — browser client + server client (service role)
- `lib/api-auth.ts` — API route auth guard (used by every `app/api/*` route)
- `lib/prisma.ts` — Prisma client singleton
- `lib/loan-math.ts` — EMI formula: `P × r × (1+r)^n / ((1+r)^n − 1)`
- `lib/credit-card-math.ts` — interest-free period, minimum due
- `store/session.store.ts` — Zustand store holding session key in memory

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server-side only
ADMIN_EMAIL=
MASTER_ENCRYPTION_KEY=         # 32-char AES-256 key
ACCESS_CODE=                   # landing page secret gate
```

## Design: "Frosted Clarity"

Glassmorphism theme throughout. Standard glass card class:
```
bg-white/60 backdrop-blur-lg border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]
```

CSS utility in `globals.css`:
```css
.glass-card {
  @apply bg-white/60 backdrop-blur-lg border border-white/40 shadow-sm;
}
```

Color tokens: safe `#34d399`, warning `#fbbf24`, danger `#f87171`, text `#1e293b`. Background gradient: `linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)`.

Budget progress bars: green < 70%, amber 70–90%, red > 90%.
