# Expense Manager — Build Instructions
_Last updated: 2026-04-18_

## Full Spec Location
`docs/superpowers/specs/2026-04-18-expense-manager-spec.md`

## Build Order (resume here if interrupted)
1. [x] Scaffold Next.js + TypeScript + Tailwind + shadcn/ui
2. [x] Set up Supabase project + write migration SQL + enable RLS
3. [x] Build encryption helpers (lib/encryption.ts)
4. [x] Build landing page with access gate
5. [x] Build login page with Supabase Auth
6. [x] Build session key modal + Zustand store
7. [x] Build expense entry form + API route
8. [x] Build budget segments UI + API
9. [x] Build category mapping system
10. [x] Build loan management + EMI calculator
11. [x] Build credit card management + calculations
12. [x] Build dashboard with summary widgets + charts
13. [x] Build reports page (all 5 report types)
14. [x] Build admin panel
15. [x] Write README with deployment + env var instructions
16. [x] Test full encryption round-trip (`scripts/encryption-roundtrip.ts`)
17. [ ] Deploy to Vercel + connect Supabase (manual — see README "Deployment")

## Key Decisions
- Two-layer AES-256 encryption (master key + user session key)
- Session key NEVER stored — Zustand memory only
- All DB calls via Next.js API routes (no direct Supabase client calls)
- Money stored as integers (paise) to avoid float errors
- Design: "Frosted Clarity" — white glassmorphism theme
- No `any` TypeScript types, Zod validation everywhere
