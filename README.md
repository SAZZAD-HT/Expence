# Expense Manager

Private-by-design personal finance dashboard. Next.js 16 + Supabase + two-layer AES-256 encryption.

All sensitive fields are encrypted twice: once with a server-held master key, and again with a per-session key the user enters on each login. The session key lives only in memory — it is never persisted to disk, cookies, or the database.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **DB:** Supabase (Postgres + Auth + RLS), Prisma ORM
- **UI:** Tailwind 4, shadcn/ui, Base UI, Recharts
- **Crypto:** crypto-js (AES-256), bcryptjs
- **State:** Zustand 5 (session memory only)
- **Validation:** Zod 4, React Hook Form

## Local Setup

```bash
npm install
cp .env.local.example .env.local    # fill values — see below
npx prisma generate
npm run dev
```

Open http://localhost:3000. The landing page gate is guarded by `ACCESS_CODE`.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role — server only, never ship to browser |
| `ADMIN_EMAIL` | yes | Email that unlocks `/admin` |
| `MASTER_ENCRYPTION_KEY` | yes | 32-char AES-256 master key (Layer 1) |
| `ACCESS_CODE` | yes | Landing page gate |
| `DATABASE_URL` | yes | Pooled Postgres (port 6543) — runtime |
| `DIRECT_URL` | yes | Direct Postgres (port 5432) — Prisma migrations only |

Generate a master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64').slice(0,32))"
```

### Database setup

The schema lives in `supabase/migrations/001_initial_schema.sql` (tables + RLS policies). Apply it via the Supabase dashboard SQL editor, or:

```bash
supabase db push
```

Prisma mirrors that schema in `prisma/schema.prisma`. After any DB change:

```bash
npx prisma db pull      # re-sync schema from Supabase
npx prisma generate     # regenerate typed client
```

## Commands

```bash
npm run dev       # dev server
npm run build     # production build
npm run lint      # ESLint
```

Utility scripts:

```bash
npx tsx scripts/rotate-key.ts        # rotate MASTER_ENCRYPTION_KEY (re-encrypts Layer 1)
npx tsx scripts/encryption-roundtrip.ts    # verify two-layer encrypt/decrypt
```

## Architecture

### Two-layer encryption

```
User input
  → Zod validate
  → Layer 2 encrypt (session key, in-memory)
  → POST /api/*
  → Layer 1 encrypt (MASTER_ENCRYPTION_KEY, server only)
  → Supabase (RLS: user_id = auth.uid())
```

Read path reverses it. The session key is entered once per login via the session-key modal and held in Zustand — never written anywhere.

### Routes

| Path | File |
|---|---|
| `/` | `app/page.tsx` (access-code gate) |
| `/login` | `app/(auth)/login/page.tsx` |
| `/dashboard` | `app/(app)/dashboard/page.tsx` |
| `/dashboard/expenses` | `app/(app)/dashboard/expenses/page.tsx` |
| `/dashboard/budget` | `app/(app)/dashboard/budget/page.tsx` |
| `/dashboard/loans` | `app/(app)/dashboard/loans/page.tsx` |
| `/dashboard/credit-cards` | `app/(app)/dashboard/credit-cards/page.tsx` |
| `/dashboard/reports` | `app/(app)/dashboard/reports/page.tsx` |
| `/admin` | `app/admin/page.tsx` (gated to `ADMIN_EMAIL`) |

### Conventions

- **No `any` types.** Zod validates every API boundary.
- **Money as integers** (poisha, 1/100 ৳). All display goes through `formatTaka` in `lib/format.ts`.
- **Currency: BDT (৳)**, locale `en-BD`.
- **Dates as ISO strings** (YYYY-MM-DD).
- **No direct Supabase calls from the browser.** All data flows through `app/api/*` routes guarded by `lib/api-auth.ts`.

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Add every variable from `.env.local.example` under **Project → Settings → Environment Variables** (Production + Preview).
   - `SUPABASE_SERVICE_ROLE_KEY` and `MASTER_ENCRYPTION_KEY` must **not** be marked `NEXT_PUBLIC_*`.
4. Make sure Supabase Auth has your Vercel domain under **Authentication → URL Configuration → Site URL / Redirect URLs**.
5. Deploy. The `npm run build` step runs `prisma generate` transitively via `@prisma/client` postinstall — if it doesn't, add a `build` script: `"build": "prisma generate && next build"`.

### Post-deploy checklist

- [ ] `/` loads and is gated by `ACCESS_CODE`
- [ ] Login succeeds with a Supabase-registered email
- [ ] Session key modal appears on first dashboard visit
- [ ] Adding an expense persists and displays decrypted on reload
- [ ] `/admin` is reachable only when logged in as `ADMIN_EMAIL`
- [ ] Rotating the session key (logout → login with different key) correctly fails to decrypt existing data

## Security notes

- The session key is **not recoverable.** Losing it means losing access to decrypted data. This is intentional.
- RLS policies enforce `user_id = auth.uid()` on every table. The service role key bypasses RLS — only use it inside API routes, never in client code.
- `MASTER_ENCRYPTION_KEY` rotation is supported via `scripts/rotate-key.ts`. Run it offline with both old and new keys available.
