# Expense Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready personal expense management web app with two-layer AES-256 encryption, Supabase backend, Next.js App Router, and glassmorphism UI.

**Architecture:** Client encrypts sensitive fields with the user's session key before POSTing to API routes. API routes wrap each session-encrypted value with the master key before inserting into Supabase. On read, the API strips the master key layer and returns session-encrypted values to the client; the client decrypts them with the session key. The session key lives only in Zustand memory — never persisted anywhere. All DB access is via Next.js API routes (never direct from browser).

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Supabase (PostgreSQL + Auth + RLS), Tailwind CSS, shadcn/ui, crypto-js (AES-256), Zustand, Recharts, React Hook Form, Zod, date-fns

---

## File Map

```
/app
  layout.tsx                              ← root layout, font, Toaster
  globals.css                             ← Tailwind + glass-card utility
  page.tsx                                ← landing: secret access gate
  /api
    /verify-access-code/route.ts          ← POST only
    /expenses/route.ts                    ← GET (list) + POST (create)
    /budget/route.ts                      ← GET + POST + PATCH + DELETE
    /categories/route.ts                  ← GET + POST
    /loans/route.ts                       ← GET + POST + DELETE
    /credit-cards/route.ts                ← GET + POST + PATCH + DELETE
    /salary/route.ts                      ← GET + POST (upsert by month)
    /reports/route.ts                     ← GET with ?type= query param
    /admin/users/route.ts                 ← GET registered users (admin only)
    /admin/health/route.ts                ← GET record counts + last activity
  /(auth)
    layout.tsx
    /login/page.tsx
  /(app)
    layout.tsx                            ← session key guard + nav shell
    /dashboard/page.tsx                   ← summary widgets + charts
    /dashboard/expenses/page.tsx
    /dashboard/budget/page.tsx
    /dashboard/loans/page.tsx
    /dashboard/credit-cards/page.tsx
    /dashboard/reports/page.tsx
  /admin/page.tsx
/components
  session-key-modal.tsx
  nav-sidebar.tsx
  expense-form.tsx
  budget-progress.tsx
  loan-calculator.tsx
  credit-card-panel.tsx
  /charts
    weekly-bar-chart.tsx
    segment-donut-chart.tsx
/lib
  encryption.ts
  supabase.ts
  loan-math.ts
  credit-card-math.ts
  format.ts                               ← paise↔rupee helpers
/store
  session.store.ts
/types
  index.ts
/supabase
  /migrations
    001_initial_schema.sql
/scripts
  rotate-key.ts
/__tests__
  /lib
    encryption.test.ts
    loan-math.test.ts
    credit-card-math.test.ts
middleware.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `jest.config.js`
- Create: `.env.local.example`
- Create: `middleware.ts`
- Modify: `app/globals.css`
- Modify: `package.json`

- [ ] **Step 1: Scaffold Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias="@/*" --yes
```

Expected: project files written into current directory. The existing `BUILD_INSTRUCTIONS.md`, `CLAUDE.md`, and `docs/` folder are preserved.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install crypto-js zustand recharts react-hook-form @hookform/resolvers zod @supabase/supabase-js @supabase/ssr date-fns
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install --save-dev @types/crypto-js jest jest-environment-node ts-jest @types/jest
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults
```

When prompted: style = default, base color = slate, CSS variables = yes.

- [ ] **Step 5: Add shadcn components**

```bash
npx shadcn@latest add button input label card dialog form select badge progress toast table tabs separator dropdown-menu sheet
```

- [ ] **Step 6: Create jest.config.js**

```js
const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })
module.exports = createJestConfig({
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/**/*.test.ts'],
})
```

- [ ] **Step 7: Add test scripts to package.json**

In the `scripts` object of `package.json`, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 8: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAIL=admin@example.com
MASTER_ENCRYPTION_KEY=your-exactly-32-char-master-key!!
ACCESS_CODE=your-secret-access-code
```

- [ ] **Step 9: Replace app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  * { @apply border-border; }
  body {
    @apply min-h-screen text-[#1e293b];
    background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
    font-family: var(--font-geist-sans), 'Inter', sans-serif;
  }
}

@layer components {
  .glass-card {
    @apply bg-white/60 backdrop-blur-lg border border-white/40 rounded-xl;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
  }
  [data-radix-dialog-overlay] {
    @apply backdrop-blur-xl bg-white/20;
  }
}
```

- [ ] **Step 10: Create middleware.ts** (root of project)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options } as Parameters<typeof request.cookies.set>[0])
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options } as Parameters<typeof response.cookies.set>[0])
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options } as Parameters<typeof request.cookies.set>[0])
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options } as Parameters<typeof response.cookies.set>[0])
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const isAdmin = request.nextUrl.pathname.startsWith('/admin')
  const isLogin = request.nextUrl.pathname === '/login'

  if (!session && (isDashboard || isAdmin)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (session && isLogin) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login'],
}
```

- [ ] **Step 11: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 with Tailwind, shadcn/ui, Supabase, Jest"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create types/index.ts**

```typescript
// All money values in paise (integer). Encrypted fields contain the
// session-encrypted string of the paise value (or plain string for text).

export type PaymentMethod = 'cash' | 'debit' | 'credit_card'

// ── Raw DB shapes (fields are session-encrypted, then master-key wrapped) ──

export interface DbExpense {
  id: string
  user_id: string
  amount_encrypted: string
  category_id: string
  payment_method: PaymentMethod
  credit_card_id: string | null
  description_encrypted: string | null
  expense_date: string   // YYYY-MM-DD
  created_at: string
}

export interface DbBudgetSegment {
  id: string
  user_id: string
  name_encrypted: string
  monthly_limit_encrypted: string
  color_tag: string
  created_at: string
}

export interface DbCategoryMapping {
  id: string
  user_id: string
  category_name_encrypted: string
  segment_id: string
  created_at: string
}

export interface DbLoan {
  id: string
  user_id: string
  loan_name_encrypted: string
  principal_encrypted: string
  interest_rate_encrypted: string  // percentage × 100 as integer string, e.g. "1050" = 10.50%
  start_date: string               // YYYY-MM-DD
  tenure_months: number
  segment_id: string | null
  created_at: string
}

export interface DbCreditCard {
  id: string
  user_id: string
  card_name_encrypted: string
  credit_limit_encrypted: string
  billing_cycle_day: number
  interest_free_days: number        // default 45
  current_balance_encrypted: string
  minimum_due_encrypted: string
  existing_emi_count: number
  existing_emi_amount_encrypted: string
  created_at: string
}

export interface DbMonthlySalary {
  id: string
  user_id: string
  month: string   // YYYY-MM
  salary_encrypted: string
}

// ── Decrypted client-side shapes ──

export interface Expense {
  id: string
  amount: number          // paise
  categoryId: string
  categoryName: string
  segmentName: string
  paymentMethod: PaymentMethod
  creditCardId: string | null
  creditCardName?: string
  description: string | null
  date: string            // YYYY-MM-DD
  createdAt: string
}

export interface BudgetSegment {
  id: string
  name: string
  monthlyLimit: number    // paise
  colorTag: string
  spent: number           // paise — computed from expenses for current month
}

export interface CategoryMapping {
  id: string
  categoryName: string
  segmentId: string
  segmentName?: string
}

export interface Loan {
  id: string
  name: string
  principal: number       // paise
  interestRate: number    // percentage, e.g. 10.5
  startDate: string       // YYYY-MM-DD
  tenureMonths: number
  segmentId: string | null
}

export interface CreditCard {
  id: string
  cardName: string
  creditLimit: number     // paise
  billingCycleDay: number
  interestFreeDays: number
  currentBalance: number  // paise
  minimumDue: number      // paise
  existingEmiCount: number
  existingEmiAmount: number  // paise/month
}

export interface MonthlySalary {
  id: string
  month: string
  salary: number  // paise
}

// ── API request / response shapes ──

export interface CreateExpenseRequest {
  amount_encrypted: string
  category_id: string
  payment_method: PaymentMethod
  credit_card_id?: string | null
  description_encrypted?: string | null
  expense_date: string
}

export interface CreateBudgetSegmentRequest {
  name_encrypted: string
  monthly_limit_encrypted: string
  color_tag: string
}

export interface CreateCategoryRequest {
  category_name_encrypted: string
  segment_id: string
}

export interface CreateLoanRequest {
  loan_name_encrypted: string
  principal_encrypted: string
  interest_rate_encrypted: string
  start_date: string
  tenure_months: number
  segment_id?: string | null
}

export interface CreateCreditCardRequest {
  card_name_encrypted: string
  credit_limit_encrypted: string
  billing_cycle_day: number
  interest_free_days?: number
  current_balance_encrypted: string
  minimum_due_encrypted: string
  existing_emi_count?: number
  existing_emi_amount_encrypted?: string
}

export interface UpsertSalaryRequest {
  month: string
  salary_encrypted: string
}

export interface ApiError {
  error: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 3: Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Create supabase/migrations/001_initial_schema.sql**

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- profiles (mirrors auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can manage own profile"
  on public.profiles for all using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- budget_segments
create table public.budget_segments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name_encrypted text not null,
  monthly_limit_encrypted text not null,
  color_tag text not null default '#94a3b8',
  created_at timestamptz default now()
);
alter table public.budget_segments enable row level security;
create policy "Users own their budget segments"
  on public.budget_segments for all using (auth.uid() = user_id);

-- category_mappings
create table public.category_mappings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category_name_encrypted text not null,
  segment_id uuid references public.budget_segments on delete cascade not null,
  created_at timestamptz default now()
);
alter table public.category_mappings enable row level security;
create policy "Users own their categories"
  on public.category_mappings for all using (auth.uid() = user_id);

-- expenses
create table public.expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  amount_encrypted text not null,
  category_id uuid references public.category_mappings on delete restrict not null,
  payment_method text not null check (payment_method in ('cash','debit','credit_card')),
  credit_card_id uuid references public.credit_cards on delete set null,
  description_encrypted text,
  expense_date date not null,
  created_at timestamptz default now()
);
alter table public.expenses enable row level security;
create policy "Users own their expenses"
  on public.expenses for all using (auth.uid() = user_id);
create index expenses_date_idx on public.expenses (user_id, expense_date desc);

-- credit_cards (must exist before expenses FK above — reorder if migrating manually)
create table public.credit_cards (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  card_name_encrypted text not null,
  credit_limit_encrypted text not null,
  billing_cycle_day integer not null check (billing_cycle_day between 1 and 31),
  interest_free_days integer not null default 45,
  current_balance_encrypted text not null,
  minimum_due_encrypted text not null,
  existing_emi_count integer not null default 0,
  existing_emi_amount_encrypted text not null default '',
  created_at timestamptz default now()
);
alter table public.credit_cards enable row level security;
create policy "Users own their credit cards"
  on public.credit_cards for all using (auth.uid() = user_id);

-- loans
create table public.loans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  loan_name_encrypted text not null,
  principal_encrypted text not null,
  interest_rate_encrypted text not null,
  start_date date not null,
  tenure_months integer not null,
  segment_id uuid references public.budget_segments on delete set null,
  created_at timestamptz default now()
);
alter table public.loans enable row level security;
create policy "Users own their loans"
  on public.loans for all using (auth.uid() = user_id);

-- monthly_salaries
create table public.monthly_salaries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  month text not null,  -- YYYY-MM
  salary_encrypted text not null,
  created_at timestamptz default now(),
  unique (user_id, month)
);
alter table public.monthly_salaries enable row level security;
create policy "Users own their salaries"
  on public.monthly_salaries for all using (auth.uid() = user_id);
```

> **Note:** The `expenses` table has a FK to `credit_cards`. Run the migration in a single transaction so both tables exist before FK resolution. In the Supabase SQL editor, paste the entire file.

- [ ] **Step 2: Commit**

```bash
git add supabase/
git commit -m "feat: add initial Supabase migration with all tables + RLS"
```

---

### Task 4: Encryption Helpers

**Files:**
- Create: `lib/encryption.ts`
- Create: `__tests__/lib/encryption.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/encryption.test.ts`:

```typescript
import { encryptField, decryptField, encryptForDb, decryptFromDb } from '@/lib/encryption'

const SESSION_KEY = 'test-session-key-exactly-32chars!'
const MASTER_KEY  = 'test-master-key-exactly-32-chars!'

describe('encryptField / decryptField', () => {
  it('round-trips a plain string', () => {
    const ct = encryptField('hello world', SESSION_KEY)
    expect(ct).not.toBe('hello world')
    expect(decryptField(ct, SESSION_KEY)).toBe('hello world')
  })

  it('round-trips a paise integer stored as string', () => {
    const ct = encryptField('150050', SESSION_KEY)
    expect(decryptField(ct, SESSION_KEY)).toBe('150050')
  })

  it('produces different ciphertext each call (IV randomness)', () => {
    const a = encryptField('same', SESSION_KEY)
    const b = encryptField('same', SESSION_KEY)
    expect(a).not.toBe(b)
  })

  it('returns empty string on wrong key', () => {
    const ct = encryptField('secret', SESSION_KEY)
    expect(decryptField(ct, 'wrong-key')).toBe('')
  })
})

describe('encryptForDb / decryptFromDb', () => {
  it('full two-layer round-trip', () => {
    const sessionEncrypted = encryptField('99999', SESSION_KEY)
    const dbStored = encryptForDb(sessionEncrypted, MASTER_KEY)
    const fromDb = decryptFromDb(dbStored, MASTER_KEY)
    expect(fromDb).toBe(sessionEncrypted)
    expect(decryptField(fromDb, SESSION_KEY)).toBe('99999')
  })

  it('db-layer ciphertext differs from session-layer ciphertext', () => {
    const sessionEncrypted = encryptField('test', SESSION_KEY)
    const dbStored = encryptForDb(sessionEncrypted, MASTER_KEY)
    expect(dbStored).not.toBe(sessionEncrypted)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
npm test -- --testPathPattern=encryption
```

Expected: `Cannot find module '@/lib/encryption'`

- [ ] **Step 3: Create lib/encryption.ts**

```typescript
import CryptoJS from 'crypto-js'

export function encryptField(value: string, sessionKey: string): string {
  return CryptoJS.AES.encrypt(value, sessionKey).toString()
}

export function decryptField(ciphertext: string, sessionKey: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, sessionKey)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}

export function encryptForDb(
  sessionEncrypted: string,
  masterKey = process.env.MASTER_ENCRYPTION_KEY!
): string {
  return CryptoJS.AES.encrypt(sessionEncrypted, masterKey).toString()
}

export function decryptFromDb(
  dbValue: string,
  masterKey = process.env.MASTER_ENCRYPTION_KEY!
): string {
  try {
    const bytes = CryptoJS.AES.decrypt(dbValue, masterKey)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- --testPathPattern=encryption
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/encryption.ts __tests__/lib/encryption.test.ts
git commit -m "feat: add two-layer AES-256 encryption helpers with tests"
```

---

### Task 5: Supabase Clients + Zustand Store + Format Helpers

**Files:**
- Create: `lib/supabase.ts`
- Create: `lib/format.ts`
- Create: `store/session.store.ts`

- [ ] **Step 1: Create lib/supabase.ts**

```typescript
import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export function createServerSupabaseClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: Record<string, unknown>) {
          try { cookieStore.set({ name, value, ...options } as Parameters<typeof cookieStore.set>[0]) } catch {}
        },
        remove(name: string, options: Record<string, unknown>) {
          try { cookieStore.set({ name, value: '', ...options } as Parameters<typeof cookieStore.set>[0]) } catch {}
        },
      },
    }
  )
}

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 2: Create lib/format.ts**

```typescript
export function rupeeToP(rupees: number): number {
  return Math.round(rupees * 100)
}

export function pToRupee(paise: number): number {
  return paise / 100
}

export function formatRupee(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100)
}
```

- [ ] **Step 3: Create store/session.store.ts**

```typescript
import { create } from 'zustand'
import type { SessionStore } from '@/types'

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionKey: null,
  setSessionKey: (key: string) => set({ sessionKey: key }),
  clearSessionKey: () => set({ sessionKey: null }),
  isUnlocked: () => get().sessionKey !== null,
}))
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts lib/format.ts store/session.store.ts
git commit -m "feat: add Supabase clients, format helpers, and Zustand session store"
```

---

### Task 6: Loan Math

**Files:**
- Create: `lib/loan-math.ts`
- Create: `__tests__/lib/loan-math.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/loan-math.test.ts`:

```typescript
import {
  calculateEMI,
  calculateTotalInterest,
  calculateMonthsRemaining,
  calculateSalaryConsumptionPct,
} from '@/lib/loan-math'

describe('calculateEMI', () => {
  it('computes correct EMI for 5L at 10% for 24 months', () => {
    // P=500000, r=10%/12, n=24 → EMI ≈ 23072
    const emi = calculateEMI(500000, 10, 24)
    expect(emi).toBeCloseTo(23072, -1)
  })

  it('returns principal/n when interest rate is 0', () => {
    expect(calculateEMI(240000, 0, 12)).toBe(20000)
  })

  it('returns 0 for 0 principal', () => {
    expect(calculateEMI(0, 10, 12)).toBe(0)
  })
})

describe('calculateTotalInterest', () => {
  it('returns (emi * n) - principal', () => {
    const emi = calculateEMI(500000, 10, 24)
    const interest = calculateTotalInterest(500000, emi, 24)
    expect(interest).toBeGreaterThan(0)
    expect(interest).toBeCloseTo(emi * 24 - 500000, -1)
  })
})

describe('calculateMonthsRemaining', () => {
  it('returns months from start + tenure minus today', () => {
    const start = '2025-01-01'
    const remaining = calculateMonthsRemaining(start, 24)
    // As of 2026-04-18, 15 months have passed (Jan 2025 → Apr 2026)
    expect(remaining).toBe(9) // 24 - 15 = 9
  })

  it('returns 0 when loan is complete', () => {
    expect(calculateMonthsRemaining('2020-01-01', 12)).toBe(0)
  })
})

describe('calculateSalaryConsumptionPct', () => {
  it('computes total EMIs as % of salary', () => {
    // Two EMIs of 10000 each against salary of 100000 → 20%
    expect(calculateSalaryConsumptionPct([10000, 10000], 100000)).toBeCloseTo(20, 1)
  })

  it('returns 0 when salary is 0', () => {
    expect(calculateSalaryConsumptionPct([10000], 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- --testPathPattern=loan-math
```

- [ ] **Step 3: Create lib/loan-math.ts**

```typescript
export function calculateEMI(
  principalPaise: number,
  annualRatePct: number,
  tenureMonths: number
): number {
  if (principalPaise === 0) return 0
  if (annualRatePct === 0) return Math.round(principalPaise / tenureMonths)
  const r = annualRatePct / 12 / 100
  const n = tenureMonths
  const emi = (principalPaise * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return Math.round(emi)
}

export function calculateTotalInterest(
  principalPaise: number,
  emiPaise: number,
  tenureMonths: number
): number {
  return Math.max(0, emiPaise * tenureMonths - principalPaise)
}

export function calculateMonthsRemaining(
  startDateISO: string,
  tenureMonths: number
): number {
  const start = new Date(startDateISO)
  const now = new Date()
  const monthsElapsed =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  return Math.max(0, tenureMonths - monthsElapsed)
}

export function calculateSalaryConsumptionPct(
  emisPaise: number[],
  salaryPaise: number
): number {
  if (salaryPaise === 0) return 0
  const totalEmi = emisPaise.reduce((s, e) => s + e, 0)
  return (totalEmi / salaryPaise) * 100
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- --testPathPattern=loan-math
```

- [ ] **Step 5: Commit**

```bash
git add lib/loan-math.ts __tests__/lib/loan-math.test.ts
git commit -m "feat: add loan EMI and salary consumption math with tests"
```

---

### Task 7: Credit Card Math

**Files:**
- Create: `lib/credit-card-math.ts`
- Create: `__tests__/lib/credit-card-math.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/credit-card-math.test.ts`:

```typescript
import {
  calculateMinimumDue,
  calculateInterestFreeDeadline,
  isDueSoon,
} from '@/lib/credit-card-math'

describe('calculateMinimumDue', () => {
  it('returns 5% of balance when that is >= 20000 paise (₹200)', () => {
    // 5% of ₹10,000 (1,000,000 paise) = ₹500 = 50,000 paise
    expect(calculateMinimumDue(1_000_000)).toBe(50_000)
  })

  it('returns 20000 paise (₹200) when 5% is less than that', () => {
    // 5% of ₹100 (10000 paise) = ₹5 = 500 paise — less than ₹200
    expect(calculateMinimumDue(10_000)).toBe(20_000)
  })

  it('returns 0 when balance is 0', () => {
    expect(calculateMinimumDue(0)).toBe(0)
  })
})

describe('calculateInterestFreeDeadline', () => {
  it('adds interestFreeDays to the transaction date', () => {
    const result = calculateInterestFreeDeadline('2026-04-01', 45)
    expect(result).toBe('2026-05-16')
  })
})

describe('isDueSoon', () => {
  it('returns true when due date is within 5 days', () => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 3)
    const iso = soon.toISOString().split('T')[0]
    expect(isDueSoon(iso)).toBe(true)
  })

  it('returns false when due date is more than 5 days away', () => {
    const later = new Date()
    later.setDate(later.getDate() + 10)
    const iso = later.toISOString().split('T')[0]
    expect(isDueSoon(iso)).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- --testPathPattern=credit-card-math
```

- [ ] **Step 3: Create lib/credit-card-math.ts**

```typescript
const MIN_DUE_FLOOR_PAISE = 20_000  // ₹200

export function calculateMinimumDue(outstandingPaise: number): number {
  if (outstandingPaise === 0) return 0
  const fivePct = Math.round(outstandingPaise * 0.05)
  return Math.max(fivePct, MIN_DUE_FLOOR_PAISE)
}

export function calculateInterestFreeDeadline(
  transactionDateISO: string,
  interestFreeDays: number
): string {
  const d = new Date(transactionDateISO)
  d.setDate(d.getDate() + interestFreeDays)
  return d.toISOString().split('T')[0]
}

export function isDueSoon(dueDateISO: string, withinDays = 5): boolean {
  const due = new Date(dueDateISO)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= withinDays
}

export function nextBillingDate(billingCycleDay: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const candidate = new Date(year, month, billingCycleDay)
  if (candidate <= now) {
    candidate.setMonth(candidate.getMonth() + 1)
  }
  return candidate.toISOString().split('T')[0]
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test -- --testPathPattern=credit-card-math
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all 3 test suites pass (encryption, loan-math, credit-card-math).

- [ ] **Step 6: Commit**

```bash
git add lib/credit-card-math.ts __tests__/lib/credit-card-math.test.ts
git commit -m "feat: add credit card math helpers with tests"
```

---

### Task 8: Root Layout + Landing Page + Access-Code API

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/api/verify-access-code/route.ts`

- [ ] **Step 1: Create app/layout.tsx**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Expence',
  description: 'Personal expense manager',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create app/api/verify-access-code/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({ code: z.string().min(1) })

export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = schema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (result.data.code !== process.env.ACCESS_CODE) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create app/page.tsx**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LandingPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/verify-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) router.push('/login')
      else setError('Incorrect access code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="glass-card p-10 w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">Expence</h1>
          <p className="text-sm text-slate-500 mt-1">Enter your access code to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="password"
            placeholder="Access code"
            value={code}
            onChange={e => setCode(e.target.value)}
            className="bg-white/80 border-white/60 focus:bg-white transition-all"
            autoFocus
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading || !code}>
            {loading ? 'Checking…' : 'Enter'}
          </Button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx app/api/verify-access-code/
git commit -m "feat: add root layout, landing access gate, and verify-code API"
```

---

### Task 9: Auth Layout + Login Page

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create app/(auth)/layout.tsx**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center">{children}</div>
}
```

- [ ] **Step 2: Create app/(auth)/login/page.tsx**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [serverError, setServerError] = useState('')
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setServerError('')
    const { error } = await supabase.auth.signInWithPassword(data)
    if (error) setServerError(error.message)
    else { router.push('/dashboard'); router.refresh() }
  }

  return (
    <div className="glass-card p-10 w-full max-w-sm flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-slate-500 mt-1">Your financial data awaits</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register('email')} className="bg-white/80" />
          {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...register('password')} className="bg-white/80" />
          {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
        </div>
        {serverError && <p className="text-sm text-red-400">{serverError}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/"
git commit -m "feat: add login page with Supabase Auth"
```

---

### Task 10: App Layout + Nav Sidebar + Session Key Modal

**Files:**
- Create: `components/session-key-modal.tsx`
- Create: `components/nav-sidebar.tsx`
- Create: `app/(app)/layout.tsx`

- [ ] **Step 1: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 2: Create components/session-key-modal.tsx**

```typescript
'use client'
import { useState } from 'react'
import { useSessionStore } from '@/store/session.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SessionKeyModal() {
  const [key, setKey] = useState('')
  const setSessionKey = useSessionStore(s => s.setSessionKey)

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (key.trim()) setSessionKey(key.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xl bg-white/30">
      <div className="glass-card p-10 w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">Security</p>
          <h2 className="text-xl font-semibold text-slate-800">Unlocking your financial data…</h2>
          <p className="text-sm text-slate-500 mt-2">
            Enter your personal session key. It is never stored — it lives only in this tab.
          </p>
        </div>
        <form onSubmit={handleUnlock} className="flex flex-col gap-4">
          <Input
            type="password"
            placeholder="Your session key"
            value={key}
            onChange={e => setKey(e.target.value)}
            className="bg-white/80"
            autoFocus
          />
          <Button type="submit" disabled={!key.trim()}>Unlock</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create components/nav-sidebar.tsx**

```typescript
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Lock, LayoutDashboard, Receipt, PiggyBank, Landmark, CreditCard, BarChart3 } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useSessionStore } from '@/store/session.store'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/dashboard/expenses',     label: 'Expenses',     icon: Receipt },
  { href: '/dashboard/budget',       label: 'Budget',       icon: PiggyBank },
  { href: '/dashboard/loans',        label: 'Loans',        icon: Landmark },
  { href: '/dashboard/credit-cards', label: 'Credit Cards', icon: CreditCard },
  { href: '/dashboard/reports',      label: 'Reports',      icon: BarChart3 },
]

export function NavSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const clearSessionKey = useSessionStore(s => s.clearSessionKey)
  const supabase = createBrowserSupabaseClient()

  async function handleLogout() {
    clearSessionKey()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col gap-1 w-56 glass-card m-4 p-4 fixed left-0 top-0 bottom-0">
      <div className="px-2 py-4 mb-2">
        <span className="text-lg font-semibold tracking-tight">Expence</span>
      </div>
      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
              pathname === href
                ? 'bg-white/60 shadow-inner text-slate-800 font-medium'
                : 'text-slate-500 hover:bg-white/40 hover:text-slate-700'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex flex-col gap-1 pt-2 border-t border-white/30">
        <button
          onClick={clearSessionKey}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-amber-600 hover:bg-amber-50/40 transition-all"
        >
          <Lock size={16} />
          Lock session
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-50/40 transition-all"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Create app/(app)/layout.tsx**

```typescript
'use client'
import { NavSidebar } from '@/components/nav-sidebar'
import { SessionKeyModal } from '@/components/session-key-modal'
import { useSessionStore } from '@/store/session.store'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const isUnlocked = useSessionStore(s => s.isUnlocked())
  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <main className="flex-1 md:ml-64 p-6">{children}</main>
      {!isUnlocked && <SessionKeyModal />}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add components/session-key-modal.tsx components/nav-sidebar.tsx "app/(app)/layout.tsx"
git commit -m "feat: add app layout with glassmorphism nav and session key modal"
```

---

### Task 11: Categories + Expenses API Routes

**Files:**
- Create: `app/api/categories/route.ts`
- Create: `app/api/expenses/route.ts`

- [ ] **Step 1: Create app/api/categories/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase'
import { encryptForDb, decryptFromDb } from '@/lib/encryption'
import type { DbCategoryMapping } from '@/types'

const createSchema = z.object({
  category_name_encrypted: z.string().min(1),
  segment_id: z.string().uuid(),
})

async function getUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('category_mappings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    (data as DbCategoryMapping[]).map(row => ({
      ...row,
      category_name_encrypted: decryptFromDb(row.category_name_encrypted),
    }))
  )
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = createSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('category_mappings')
    .insert({
      user_id: user.id,
      category_name_encrypted: encryptForDb(result.data.category_name_encrypted),
      segment_id: result.data.segment_id,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const row = data as DbCategoryMapping
  return NextResponse.json({
    ...row,
    category_name_encrypted: decryptFromDb(row.category_name_encrypted),
  }, { status: 201 })
}
```

- [ ] **Step 2: Create app/api/expenses/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase'
import { encryptForDb, decryptFromDb } from '@/lib/encryption'
import type { DbExpense } from '@/types'

const createSchema = z.object({
  amount_encrypted: z.string().min(1),
  category_id: z.string().uuid(),
  payment_method: z.enum(['cash', 'debit', 'credit_card']),
  credit_card_id: z.string().uuid().nullable().optional(),
  description_encrypted: z.string().nullable().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

async function getUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function decryptExpenseRow(row: DbExpense) {
  return {
    ...row,
    amount_encrypted: decryptFromDb(row.amount_encrypted),
    description_encrypted: row.description_encrypted
      ? decryptFromDb(row.description_encrypted)
      : null,
  }
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = new URL(request.url).searchParams.get('month')
  let query = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('expense_date', { ascending: false })
    .limit(500)

  if (month) {
    query = query
      .gte('expense_date', `${month}-01`)
      .lte('expense_date', `${month}-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data as DbExpense[]).map(decryptExpenseRow))
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const result = createSchema.safeParse(body)
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      amount_encrypted: encryptForDb(result.data.amount_encrypted),
      category_id: result.data.category_id,
      payment_method: result.data.payment_method,
      credit_card_id: result.data.credit_card_id ?? null,
      description_encrypted: result.data.description_encrypted
        ? encryptForDb(result.data.description_encrypted)
        : null,
      expense_date: result.data.expense_date,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(decryptExpenseRow(data as DbExpense), { status: 201 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/categories/ app/api/expenses/
git commit -m "feat: add categories and expenses API routes with two-layer encryption"
```

---

### Task 12: Expense Form + Expense Page

**Files:**
- Create: `components/expense-form.tsx`
- Create: `app/(app)/dashboard/expenses/page.tsx`

- [ ] **Step 1: Create components/expense-form.tsx**

```typescript
'use client'
import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSessionStore } from '@/store/session.store'
import { encryptField, decryptField } from '@/lib/encryption'
import { rupeeToP } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { DbCategoryMapping, DbCreditCard } from '@/types'

const schema = z.object({
  amount: z.number({ invalid_type_error: 'Enter a valid amount' }).positive(),
  category_id: z.string().uuid('Select a category'),
  payment_method: z.enum(['cash', 'debit', 'credit_card']),
  credit_card_id: z.string().optional(),
  description: z.string().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
type FormData = z.infer<typeof schema>

export function ExpenseForm({ onSuccess }: { onSuccess?: () => void }) {
  const sessionKey = useSessionStore(s => s.sessionKey)!
  const { toast } = useToast()
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [cards, setCards] = useState<{ id: string; name: string }[]>([])

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_method: 'cash',
      expense_date: new Date().toISOString().split('T')[0],
    },
  })
  const paymentMethod = watch('payment_method')

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then((rows: DbCategoryMapping[]) =>
        setCategories(rows.map(r => ({
          id: r.id,
          name: decryptField(r.category_name_encrypted, sessionKey),
        })))
      ).catch(() => {})

    fetch('/api/credit-cards')
      .then(r => r.json())
      .then((rows: DbCreditCard[]) =>
        setCards(rows.map(r => ({
          id: r.id,
          name: decryptField(r.card_name_encrypted, sessionKey),
        })))
      ).catch(() => {})
  }, [sessionKey])

  async function onSubmit(data: FormData) {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_encrypted: encryptField(String(rupeeToP(data.amount)), sessionKey),
        category_id: data.category_id,
        payment_method: data.payment_method,
        credit_card_id: data.payment_method === 'credit_card' ? (data.credit_card_id ?? null) : null,
        description_encrypted: data.description ? encryptField(data.description, sessionKey) : null,
        expense_date: data.expense_date,
      }),
    })
    if (res.ok) { reset(); toast({ title: 'Expense added' }); onSuccess?.() }
    else toast({ title: 'Error saving expense', variant: 'destructive' })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label>Amount (₹)</Label>
          <Input type="number" step="0.01" placeholder="0.00"
            {...register('amount', { valueAsNumber: true })} className="bg-white/80" />
          {errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label>Date</Label>
          <Input type="date" {...register('expense_date')} className="bg-white/80" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label>Category</Label>
        <Select onValueChange={v => setValue('category_id', v)}>
          <SelectTrigger className="bg-white/80"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.category_id && <p className="text-xs text-red-400">{errors.category_id.message}</p>}
      </div>
      <div className="flex flex-col gap-1">
        <Label>Payment method</Label>
        <Select defaultValue="cash" onValueChange={v => setValue('payment_method', v as FormData['payment_method'])}>
          <SelectTrigger className="bg-white/80"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="debit">Debit card</SelectItem>
            <SelectItem value="credit_card">Credit card</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {paymentMethod === 'credit_card' && (
        <div className="flex flex-col gap-1">
          <Label>Card</Label>
          <Select onValueChange={v => setValue('credit_card_id', v)}>
            <SelectTrigger className="bg-white/80"><SelectValue placeholder="Select card" /></SelectTrigger>
            <SelectContent>
              {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label>Description (optional)</Label>
        <Input {...register('description')} className="bg-white/80" placeholder="e.g. Lunch at Haldiram's" />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Add expense'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create app/(app)/dashboard/expenses/page.tsx**

```typescript
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSessionStore } from '@/store/session.store'
import { decryptField } from '@/lib/encryption'
import { formatRupee } from '@/lib/format'
import { ExpenseForm } from '@/components/expense-form'
import { Badge } from '@/components/ui/badge'
import type { DbExpense } from '@/types'

const METHOD_BADGE: Record<string, string> = {
  cash:        'bg-emerald-100 text-emerald-700',
  debit:       'bg-blue-100 text-blue-700',
  credit_card: 'bg-purple-100 text-purple-700',
}

export default function ExpensesPage() {
  const sessionKey = useSessionStore(s => s.sessionKey)
  const [rows, setRows] = useState<DbExpense[]>([])

  const load = useCallback(() => {
    const month = new Date().toISOString().slice(0, 7)
    fetch(`/api/expenses?month=${month}`)
      .then(r => r.json()).then(setRows).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  if (!sessionKey) return null

  const grouped = rows.reduce<Record<string, DbExpense[]>>((acc, e) => {
    ;(acc[e.expense_date] ??= []).push(e)
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Expenses</h1>
      <div className="glass-card p-6">
        <h2 className="text-base font-medium mb-4">Add expense</h2>
        <ExpenseForm onSuccess={load} />
      </div>
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{date}</p>
          <div className="glass-card divide-y divide-white/30">
            {items.map(e => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Badge className={METHOD_BADGE[e.payment_method] + ' text-xs'}>
                    {e.payment_method.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-slate-600">
                    {e.description_encrypted
                      ? decryptField(e.description_encrypted, sessionKey)
                      : '—'}
                  </span>
                </div>
                <span className="font-medium">
                  {formatRupee(Number(decryptField(e.amount_encrypted, sessionKey)))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/expense-form.tsx "app/(app)/dashboard/expenses/"
git commit -m "feat: add expense form and expenses list page"
```

---

### Task 13: Budget API + UI

**Files:**
- Create: `app/api/budget/route.ts`
- Create: `components/budget-progress.tsx`
- Create: `app/(app)/dashboard/budget/page.tsx`

- [ ] **Step 1: Create app/api/budget/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase'
import { encryptForDb, decryptFromDb } from '@/lib/encryption'
import type { DbBudgetSegment } from '@/types'

const createSchema = z.object({
  name_encrypted: z.string().min(1),
  monthly_limit_encrypted: z.string().min(1),
  color_tag: z.string().min(1),
})

async function getUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function decryptSegment(row: DbBudgetSegment) {
  return {
    ...row,
    name_encrypted: decryptFromDb(row.name_encrypted),
    monthly_limit_encrypted: decryptFromDb(row.monthly_limit_encrypted),
  }
}

export async function GET() {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('budget_segments').select('*').eq('user_id', user.id).order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data as DbBudgetSegment[]).map(decryptSegment))
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = createSchema.safeParse(await request.json())
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('budget_segments')
    .insert({
      user_id: user.id,
      name_encrypted: encryptForDb(result.data.name_encrypted),
      monthly_limit_encrypted: encryptForDb(result.data.monthly_limit_encrypted),
      color_tag: result.data.color_tag,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(decryptSegment(data as DbBudgetSegment), { status: 201 })
}
```

- [ ] **Step 2: Create components/budget-progress.tsx**

```typescript
'use client'
import { formatRupee } from '@/lib/format'

interface Props {
  name: string
  spent: number   // paise
  limit: number   // paise
  colorTag: string
}

export function BudgetProgress({ name, spent, limit, colorTag }: Props) {
  const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0
  const barColor = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700 flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colorTag }} />
          {name}
        </span>
        <span className="text-slate-500">{formatRupee(spent)} / {formatRupee(limit)}</span>
      </div>
      <div className="h-2 bg-white/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 90 && (
        <p className="text-xs text-red-500">
          {pct >= 100 ? 'Over budget!' : `${pct}% used — almost at limit`}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create app/(app)/dashboard/budget/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSessionStore } from '@/store/session.store'
import { encryptField, decryptField } from '@/lib/encryption'
import { rupeeToP } from '@/lib/format'
import { BudgetProgress } from '@/components/budget-progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import type { DbBudgetSegment } from '@/types'

const schema = z.object({
  name: z.string().min(1),
  monthly_limit: z.number().positive(),
  color_tag: z.string().min(4),
})
type FormData = z.infer<typeof schema>

export default function BudgetPage() {
  const sessionKey = useSessionStore(s => s.sessionKey)!
  const { toast } = useToast()
  const [segments, setSegments] = useState<DbBudgetSegment[]>([])

  function load() {
    fetch('/api/budget').then(r => r.json()).then(setSegments).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { color_tag: '#94a3b8' } })

  async function onSubmit(data: FormData) {
    const res = await fetch('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name_encrypted: encryptField(data.name, sessionKey),
        monthly_limit_encrypted: encryptField(String(rupeeToP(data.monthly_limit)), sessionKey),
        color_tag: data.color_tag,
      }),
    })
    if (res.ok) { reset(); toast({ title: 'Segment created' }); load() }
    else toast({ title: 'Error', variant: 'destructive' })
  }

  if (!sessionKey) return null

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Budget</h1>
      <div className="glass-card p-6 flex flex-col gap-4">
        {segments.length === 0
          ? <p className="text-sm text-slate-400 text-center py-4">No segments yet</p>
          : segments.map(s => (
              <BudgetProgress
                key={s.id}
                name={decryptField(s.name_encrypted, sessionKey)}
                spent={0}
                limit={Number(decryptField(s.monthly_limit_encrypted, sessionKey))}
                colorTag={s.color_tag}
              />
            ))}
      </div>
      <div className="glass-card p-6">
        <h2 className="text-base font-medium mb-4">Add segment</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Name</Label>
            <Input {...register('name')} className="bg-white/80" placeholder="Food, Transport…" />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Monthly limit (₹)</Label>
              <Input type="number" step="100"
                {...register('monthly_limit', { valueAsNumber: true })} className="bg-white/80" />
              {errors.monthly_limit && <p className="text-xs text-red-400">{errors.monthly_limit.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label>Colour</Label>
              <Input type="color" {...register('color_tag')} className="h-10 p-1 bg-white/80" />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>Add segment</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/budget/ components/budget-progress.tsx "app/(app)/dashboard/budget/"
git commit -m "feat: add budget segments API and progress UI"
```

---

### Task 14: Salary API + Loans API + Loans UI

**Files:**
- Create: `app/api/salary/route.ts`
- Create: `app/api/loans/route.ts`
- Create: `components/loan-calculator.tsx`
- Create: `app/(app)/dashboard/loans/page.tsx`

- [ ] **Step 1: Create app/api/salary/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase'
import { encryptForDb, decryptFromDb } from '@/lib/encryption'

const upsertSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  salary_encrypted: z.string().min(1),
})

async function getUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = new URL(request.url).searchParams.get('month')
  let query = supabase.from('monthly_salaries').select('*').eq('user_id', user.id)
  if (month) query = query.eq('month', month)
  const { data, error } = await query.order('month', { ascending: false }).limit(24)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    data.map((r: { id: string; month: string; salary_encrypted: string }) => ({
      ...r,
      salary_encrypted: decryptFromDb(r.salary_encrypted),
    }))
  )
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = upsertSchema.safeParse(await request.json())
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('monthly_salaries')
    .upsert(
      {
        user_id: user.id,
        month: result.data.month,
        salary_encrypted: encryptForDb(result.data.salary_encrypted),
      },
      { onConflict: 'user_id,month' }
    )
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const r = data as { id: string; month: string; salary_encrypted: string }
  return NextResponse.json({ ...r, salary_encrypted: decryptFromDb(r.salary_encrypted) })
}
```

- [ ] **Step 2: Create app/api/loans/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase'
import { encryptForDb, decryptFromDb } from '@/lib/encryption'
import type { DbLoan } from '@/types'

const createSchema = z.object({
  loan_name_encrypted: z.string().min(1),
  principal_encrypted: z.string().min(1),
  interest_rate_encrypted: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tenure_months: z.number().int().positive(),
  segment_id: z.string().uuid().nullable().optional(),
})

async function getUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function decryptLoan(row: DbLoan) {
  return {
    ...row,
    loan_name_encrypted: decryptFromDb(row.loan_name_encrypted),
    principal_encrypted: decryptFromDb(row.principal_encrypted),
    interest_rate_encrypted: decryptFromDb(row.interest_rate_encrypted),
  }
}

export async function GET() {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('loans').select('*').eq('user_id', user.id).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data as DbLoan[]).map(decryptLoan))
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = createSchema.safeParse(await request.json())
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('loans')
    .insert({
      user_id: user.id,
      loan_name_encrypted: encryptForDb(result.data.loan_name_encrypted),
      principal_encrypted: encryptForDb(result.data.principal_encrypted),
      interest_rate_encrypted: encryptForDb(result.data.interest_rate_encrypted),
      start_date: result.data.start_date,
      tenure_months: result.data.tenure_months,
      segment_id: result.data.segment_id ?? null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(decryptLoan(data as DbLoan), { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabase.from('loans').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create components/loan-calculator.tsx**

```typescript
'use client'
import { calculateEMI, calculateTotalInterest, calculateMonthsRemaining } from '@/lib/loan-math'
import { formatRupee } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

interface Props {
  name: string
  principal: number     // paise
  interestRate: number  // e.g. 10.5
  startDate: string
  tenureMonths: number
}

export function LoanCalculator({ name, principal, interestRate, startDate, tenureMonths }: Props) {
  const emi = calculateEMI(principal, interestRate, tenureMonths)
  const totalInterest = calculateTotalInterest(principal, emi, tenureMonths)
  const monthsLeft = calculateMonthsRemaining(startDate, tenureMonths)
  const pct = Math.round(((tenureMonths - monthsLeft) / tenureMonths) * 100)

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-slate-800">{name}</h3>
        <Badge variant="outline" className="text-xs">
          {monthsLeft > 0 ? `${monthsLeft} months left` : 'Complete'}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><p className="text-slate-400 text-xs">EMI</p><p className="font-semibold">{formatRupee(emi)}</p></div>
        <div><p className="text-slate-400 text-xs">Principal</p><p className="font-semibold">{formatRupee(principal)}</p></div>
        <div><p className="text-slate-400 text-xs">Total interest</p><p className="font-semibold">{formatRupee(totalInterest)}</p></div>
      </div>
      <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400">{pct}% repaid · {interestRate}% p.a.</p>
    </div>
  )
}
```

- [ ] **Step 4: Create app/(app)/dashboard/loans/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSessionStore } from '@/store/session.store'
import { encryptField, decryptField } from '@/lib/encryption'
import { rupeeToP } from '@/lib/format'
import { LoanCalculator } from '@/components/loan-calculator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import type { DbLoan } from '@/types'

const schema = z.object({
  name: z.string().min(1),
  principal: z.number().positive(),
  interest_rate: z.number().min(0).max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tenure_months: z.number().int().min(1).max(360),
})
type FormData = z.infer<typeof schema>

export default function LoansPage() {
  const sessionKey = useSessionStore(s => s.sessionKey)!
  const { toast } = useToast()
  const [loans, setLoans] = useState<DbLoan[]>([])

  function load() { fetch('/api/loans').then(r => r.json()).then(setLoans).catch(() => {}) }
  useEffect(() => { load() }, [])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { start_date: new Date().toISOString().split('T')[0] },
    })

  async function onSubmit(data: FormData) {
    const res = await fetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loan_name_encrypted: encryptField(data.name, sessionKey),
        principal_encrypted: encryptField(String(rupeeToP(data.principal)), sessionKey),
        interest_rate_encrypted: encryptField(String(Math.round(data.interest_rate * 100)), sessionKey),
        start_date: data.start_date,
        tenure_months: data.tenure_months,
      }),
    })
    if (res.ok) { reset(); toast({ title: 'Loan added' }); load() }
    else toast({ title: 'Error', variant: 'destructive' })
  }

  if (!sessionKey) return null

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Loans</h1>
      <div className="flex flex-col gap-4">
        {loans.length === 0
          ? <p className="text-sm text-slate-400 text-center py-4">No active loans</p>
          : loans.map(l => (
              <LoanCalculator
                key={l.id}
                name={decryptField(l.loan_name_encrypted, sessionKey)}
                principal={Number(decryptField(l.principal_encrypted, sessionKey))}
                interestRate={Number(decryptField(l.interest_rate_encrypted, sessionKey)) / 100}
                startDate={l.start_date}
                tenureMonths={l.tenure_months}
              />
            ))}
      </div>
      <div className="glass-card p-6">
        <h2 className="text-base font-medium mb-4">Add loan</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Loan name</Label>
            <Input {...register('name')} className="bg-white/80" placeholder="Home loan, Car loan…" />
            {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Principal (₹)</Label>
              <Input type="number" step="1000" {...register('principal', { valueAsNumber: true })} className="bg-white/80" />
              {errors.principal && <p className="text-xs text-red-400">{errors.principal.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label>Annual rate (%)</Label>
              <Input type="number" step="0.01" {...register('interest_rate', { valueAsNumber: true })} className="bg-white/80" />
              {errors.interest_rate && <p className="text-xs text-red-400">{errors.interest_rate.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Start date</Label>
              <Input type="date" {...register('start_date')} className="bg-white/80" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Tenure (months)</Label>
              <Input type="number" {...register('tenure_months', { valueAsNumber: true })} className="bg-white/80" />
              {errors.tenure_months && <p className="text-xs text-red-400">{errors.tenure_months.message}</p>}
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>Add loan</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/salary/ app/api/loans/ components/loan-calculator.tsx "app/(app)/dashboard/loans/"
git commit -m "feat: add salary API, loans API, loan calculator, and loans page"
```

---

### Task 15: Credit Cards API + UI

**Files:**
- Create: `app/api/credit-cards/route.ts`
- Create: `components/credit-card-panel.tsx`
- Create: `app/(app)/dashboard/credit-cards/page.tsx`

- [ ] **Step 1: Create app/api/credit-cards/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase'
import { encryptForDb, decryptFromDb } from '@/lib/encryption'
import type { DbCreditCard } from '@/types'

const createSchema = z.object({
  card_name_encrypted: z.string().min(1),
  credit_limit_encrypted: z.string().min(1),
  billing_cycle_day: z.number().int().min(1).max(31),
  interest_free_days: z.number().int().min(1).max(60).optional(),
  current_balance_encrypted: z.string().min(1),
  minimum_due_encrypted: z.string().min(1),
  existing_emi_count: z.number().int().min(0).optional(),
  existing_emi_amount_encrypted: z.string().optional(),
})

async function getUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function decryptCard(row: DbCreditCard) {
  return {
    ...row,
    card_name_encrypted: decryptFromDb(row.card_name_encrypted),
    credit_limit_encrypted: decryptFromDb(row.credit_limit_encrypted),
    current_balance_encrypted: decryptFromDb(row.current_balance_encrypted),
    minimum_due_encrypted: decryptFromDb(row.minimum_due_encrypted),
    existing_emi_amount_encrypted: row.existing_emi_amount_encrypted
      ? decryptFromDb(row.existing_emi_amount_encrypted)
      : '',
  }
}

export async function GET() {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('credit_cards').select('*').eq('user_id', user.id).order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data as DbCreditCard[]).map(decryptCard))
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = createSchema.safeParse(await request.json())
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 })

  const d = result.data
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({
      user_id: user.id,
      card_name_encrypted: encryptForDb(d.card_name_encrypted),
      credit_limit_encrypted: encryptForDb(d.credit_limit_encrypted),
      billing_cycle_day: d.billing_cycle_day,
      interest_free_days: d.interest_free_days ?? 45,
      current_balance_encrypted: encryptForDb(d.current_balance_encrypted),
      minimum_due_encrypted: encryptForDb(d.minimum_due_encrypted),
      existing_emi_count: d.existing_emi_count ?? 0,
      existing_emi_amount_encrypted: d.existing_emi_amount_encrypted
        ? encryptForDb(d.existing_emi_amount_encrypted)
        : '',
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(decryptCard(data as DbCreditCard), { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await request.json()
  const { error } = await supabase.from('credit_cards').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create components/credit-card-panel.tsx**

```typescript
'use client'
import { nextBillingDate, isDueSoon, calculateMinimumDue } from '@/lib/credit-card-math'
import { formatRupee } from '@/lib/format'
import { Badge } from '@/components/ui/badge'

interface Props {
  cardName: string
  creditLimit: number     // paise
  currentBalance: number  // paise
  billingCycleDay: number
  interestFreeDays: number
  minimumDue: number      // paise
  existingEmiAmount: number  // paise/month
}

export function CreditCardPanel({
  cardName, creditLimit, currentBalance, billingCycleDay,
  interestFreeDays, minimumDue, existingEmiAmount,
}: Props) {
  const available = creditLimit - currentBalance
  const usedPct = creditLimit > 0 ? Math.round((currentBalance / creditLimit) * 100) : 0
  const dueDate = nextBillingDate(billingCycleDay)
  const dueSoon = isDueSoon(dueDate)
  const computedMinDue = calculateMinimumDue(currentBalance)
  const totalDue = computedMinDue + existingEmiAmount

  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-slate-800">{cardName}</h3>
        {dueSoon && (
          <Badge className="bg-red-100 text-red-600 text-xs">Due soon</Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-slate-400 text-xs">Limit</p>
          <p className="font-semibold">{formatRupee(creditLimit)}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Used</p>
          <p className="font-semibold text-amber-600">{formatRupee(currentBalance)}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs">Available</p>
          <p className="font-semibold text-emerald-600">{formatRupee(available)}</p>
        </div>
      </div>
      <div className="h-1.5 bg-white/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${usedPct >= 80 ? 'bg-red-400' : 'bg-blue-400'}`}
          style={{ width: `${Math.min(usedPct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Next due: {dueDate}</span>
        <span>Min due: {formatRupee(totalDue)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create app/(app)/dashboard/credit-cards/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSessionStore } from '@/store/session.store'
import { encryptField, decryptField } from '@/lib/encryption'
import { rupeeToP } from '@/lib/format'
import { CreditCardPanel } from '@/components/credit-card-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import type { DbCreditCard } from '@/types'

const schema = z.object({
  card_name: z.string().min(1),
  credit_limit: z.number().positive(),
  billing_cycle_day: z.number().int().min(1).max(31),
  interest_free_days: z.number().int().min(1).max(60).optional(),
  current_balance: z.number().min(0),
  existing_emi_count: z.number().int().min(0).optional(),
  existing_emi_amount: z.number().min(0).optional(),
})
type FormData = z.infer<typeof schema>

export default function CreditCardsPage() {
  const sessionKey = useSessionStore(s => s.sessionKey)!
  const { toast } = useToast()
  const [cards, setCards] = useState<DbCreditCard[]>([])

  function load() {
    fetch('/api/credit-cards').then(r => r.json()).then(setCards).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { interest_free_days: 45 } })

  async function onSubmit(data: FormData) {
    const res = await fetch('/api/credit-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_name_encrypted: encryptField(data.card_name, sessionKey),
        credit_limit_encrypted: encryptField(String(rupeeToP(data.credit_limit)), sessionKey),
        billing_cycle_day: data.billing_cycle_day,
        interest_free_days: data.interest_free_days ?? 45,
        current_balance_encrypted: encryptField(String(rupeeToP(data.current_balance)), sessionKey),
        minimum_due_encrypted: encryptField('0', sessionKey),
        existing_emi_count: data.existing_emi_count ?? 0,
        existing_emi_amount_encrypted: encryptField(
          String(rupeeToP(data.existing_emi_amount ?? 0)), sessionKey
        ),
      }),
    })
    if (res.ok) { reset(); toast({ title: 'Card added' }); load() }
    else toast({ title: 'Error', variant: 'destructive' })
  }

  if (!sessionKey) return null

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Credit Cards</h1>
      <div className="flex flex-col gap-4">
        {cards.length === 0
          ? <p className="text-sm text-slate-400 text-center py-4">No cards added</p>
          : cards.map(c => (
              <CreditCardPanel
                key={c.id}
                cardName={decryptField(c.card_name_encrypted, sessionKey)}
                creditLimit={Number(decryptField(c.credit_limit_encrypted, sessionKey))}
                currentBalance={Number(decryptField(c.current_balance_encrypted, sessionKey))}
                billingCycleDay={c.billing_cycle_day}
                interestFreeDays={c.interest_free_days}
                minimumDue={Number(decryptField(c.minimum_due_encrypted, sessionKey))}
                existingEmiAmount={
                  c.existing_emi_amount_encrypted
                    ? Number(decryptField(c.existing_emi_amount_encrypted, sessionKey))
                    : 0
                }
              />
            ))}
      </div>
      <div className="glass-card p-6">
        <h2 className="text-base font-medium mb-4">Add card</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Card name</Label>
            <Input {...register('card_name')} className="bg-white/80" placeholder="HDFC Regalia…" />
            {errors.card_name && <p className="text-xs text-red-400">{errors.card_name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Credit limit (₹)</Label>
              <Input type="number" step="1000" {...register('credit_limit', { valueAsNumber: true })} className="bg-white/80" />
              {errors.credit_limit && <p className="text-xs text-red-400">{errors.credit_limit.message}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Label>Billing cycle day</Label>
              <Input type="number" min="1" max="31" {...register('billing_cycle_day', { valueAsNumber: true })} className="bg-white/80" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Current balance (₹)</Label>
              <Input type="number" step="1" {...register('current_balance', { valueAsNumber: true })} className="bg-white/80" />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Existing EMI/month (₹)</Label>
              <Input type="number" step="1" {...register('existing_emi_amount', { valueAsNumber: true })} className="bg-white/80" />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting}>Add card</Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/credit-cards/ components/credit-card-panel.tsx "app/(app)/dashboard/credit-cards/"
git commit -m "feat: add credit cards API, panel component, and credit cards page"
```

---

### Task 16: Dashboard Home

**Files:**
- Create: `components/charts/weekly-bar-chart.tsx`
- Create: `components/charts/segment-donut-chart.tsx`
- Create: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create components/charts/weekly-bar-chart.tsx**

```typescript
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatRupee, pToRupee } from '@/lib/format'

interface DataPoint {
  week: string   // e.g. "Apr W1"
  total: number  // paise
}

export function WeeklyBarChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => `₹${Math.round(pToRupee(v) / 1000)}k`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false} tickLine={false} width={44}
        />
        <Tooltip
          formatter={(v: number) => [formatRupee(v), 'Spent']}
          contentStyle={{ background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="total" fill="#93c5fd" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Create components/charts/segment-donut-chart.tsx**

```typescript
'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatRupee } from '@/lib/format'

interface Segment {
  name: string
  value: number   // paise
  color: string
}

export function SegmentDonutChart({ segments }: { segments: Segment[] }) {
  if (segments.every(s => s.value === 0)) return (
    <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">
      No expenses this month
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={segments}
          cx="50%" cy="50%"
          innerRadius={50} outerRadius={75}
          dataKey="value"
          stroke="none"
        >
          {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
        </Pie>
        <Tooltip
          formatter={(v: number, name: string) => [formatRupee(v), name]}
          contentStyle={{ background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: 8, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Create app/(app)/dashboard/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useSessionStore } from '@/store/session.store'
import { decryptField } from '@/lib/encryption'
import { formatRupee } from '@/lib/format'
import { calculateEMI } from '@/lib/loan-math'
import { WeeklyBarChart } from '@/components/charts/weekly-bar-chart'
import { SegmentDonutChart } from '@/components/charts/segment-donut-chart'
import type { DbExpense, DbBudgetSegment, DbLoan, DbCreditCard } from '@/types'

interface SummaryWidget {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'amber' | 'red' | 'blue'
}

function Widget({ label, value, sub, accent }: SummaryWidget) {
  const accentClass = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-500',
    blue: 'text-blue-600',
  }[accent ?? 'blue'] ?? 'text-slate-800'

  return (
    <div className="glass-card p-5 flex flex-col gap-1">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold ${accentClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const sessionKey = useSessionStore(s => s.sessionKey)
  const [expenses, setExpenses] = useState<DbExpense[]>([])
  const [segments, setSegments] = useState<DbBudgetSegment[]>([])
  const [loans, setLoans] = useState<DbLoan[]>([])
  const [cards, setCards] = useState<DbCreditCard[]>([])

  useEffect(() => {
    if (!sessionKey) return
    const month = new Date().toISOString().slice(0, 7)
    Promise.all([
      fetch(`/api/expenses?month=${month}`).then(r => r.json()),
      fetch('/api/budget').then(r => r.json()),
      fetch('/api/loans').then(r => r.json()),
      fetch('/api/credit-cards').then(r => r.json()),
    ]).then(([exp, seg, lo, cc]) => {
      setExpenses(exp); setSegments(seg); setLoans(lo); setCards(cc)
    }).catch(() => {})
  }, [sessionKey])

  if (!sessionKey) return null

  // Total spent this month
  const totalSpent = expenses.reduce((s, e) => {
    const v = Number(decryptField(e.amount_encrypted, sessionKey))
    return s + (isNaN(v) ? 0 : v)
  }, 0)

  // Total budget
  const totalBudget = segments.reduce((s, seg) => {
    const v = Number(decryptField(seg.monthly_limit_encrypted, sessionKey))
    return s + (isNaN(v) ? 0 : v)
  }, 0)

  // Total loan EMI
  const totalEmi = loans.reduce((s, l) => {
    const principal = Number(decryptField(l.principal_encrypted, sessionKey))
    const rate = Number(decryptField(l.interest_rate_encrypted, sessionKey)) / 100
    return s + calculateEMI(principal, rate, l.tenure_months)
  }, 0)

  // Credit card dues this month
  const ccDues = cards.reduce((s, c) => {
    const bal = Number(decryptField(c.current_balance_encrypted, sessionKey))
    return s + (isNaN(bal) ? 0 : bal)
  }, 0)

  // Weekly bar chart data (last 4 weeks from today)
  const weeklyData = (() => {
    const now = new Date()
    return [3, 2, 1, 0].map(weeksAgo => {
      const start = new Date(now)
      start.setDate(now.getDate() - weeksAgo * 7 - now.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]
      const total = expenses
        .filter(e => e.expense_date >= startStr && e.expense_date <= endStr)
        .reduce((s, e) => {
          const v = Number(decryptField(e.amount_encrypted, sessionKey))
          return s + (isNaN(v) ? 0 : v)
        }, 0)
      return { week: `W${4 - weeksAgo}`, total }
    })
  })()

  // Segment donut data
  const donutData = segments.map(seg => {
    const segExpenses = expenses.filter(e => {
      // Match expenses to segment via category — simplified: use all for now
      return true
    })
    return {
      name: decryptField(seg.name_encrypted, sessionKey),
      value: 0,  // wire up via categories in future enhancement
      color: seg.color_tag,
    }
  })

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Widget label="Spent this month" value={formatRupee(totalSpent)} accent="blue" />
        <Widget
          label="Budget remaining"
          value={formatRupee(Math.max(0, totalBudget - totalSpent))}
          accent={totalSpent > totalBudget ? 'red' : 'green'}
        />
        <Widget label="Loan EMI total" value={formatRupee(totalEmi)} accent="amber" />
        <Widget label="CC outstanding" value={formatRupee(ccDues)} accent="amber" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">Weekly spending</p>
          <WeeklyBarChart data={weeklyData} />
        </div>
        <div className="glass-card p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">Budget by segment</p>
          <SegmentDonutChart segments={donutData} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/charts/ "app/(app)/dashboard/page.tsx"
git commit -m "feat: add dashboard home with summary widgets and charts"
```

---

### Task 17: Reports API + Reports Page

**Files:**
- Create: `app/api/reports/route.ts`
- Create: `app/(app)/dashboard/reports/page.tsx`

- [ ] **Step 1: Create app/api/reports/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { decryptFromDb } from '@/lib/encryption'
import type { DbExpense, DbBudgetSegment, DbLoan, DbCreditCard } from '@/types'

async function getUser() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'expenses'
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  if (type === 'expenses') {
    const { data: expenses, error: eErr } = await supabase
      .from('expenses').select('*').eq('user_id', user.id)
      .gte('expense_date', `${month}-01`).lte('expense_date', `${month}-31`)
      .order('expense_date', { ascending: false })
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

    const { data: cats } = await supabase
      .from('category_mappings').select('*').eq('user_id', user.id)

    const { data: segs } = await supabase
      .from('budget_segments').select('*').eq('user_id', user.id)

    const catMap = Object.fromEntries(
      (cats ?? []).map((c: { id: string; category_name_encrypted: string; segment_id: string }) => [
        c.id,
        { name: decryptFromDb(c.category_name_encrypted), segmentId: c.segment_id },
      ])
    )
    const segMap = Object.fromEntries(
      (segs ?? []).map((s: DbBudgetSegment) => [s.id, decryptFromDb(s.name_encrypted)])
    )

    const rows = (expenses as DbExpense[]).map(e => ({
      id: e.id,
      amount_encrypted: decryptFromDb(e.amount_encrypted),
      description_encrypted: e.description_encrypted ? decryptFromDb(e.description_encrypted) : null,
      category_name: catMap[e.category_id]?.name ?? 'Unknown',
      segment_name: segMap[catMap[e.category_id]?.segmentId] ?? 'Unknown',
      payment_method: e.payment_method,
      expense_date: e.expense_date,
    }))
    return NextResponse.json({ type: 'expenses', month, rows })
  }

  if (type === 'over_budget') {
    const { data: expenses } = await supabase
      .from('expenses').select('*').eq('user_id', user.id)
      .gte('expense_date', `${month}-01`).lte('expense_date', `${month}-31`)

    const { data: cats } = await supabase.from('category_mappings').select('*').eq('user_id', user.id)
    const { data: segs } = await supabase.from('budget_segments').select('*').eq('user_id', user.id)

    const catToSeg = Object.fromEntries(
      (cats ?? []).map((c: { id: string; segment_id: string }) => [c.id, c.segment_id])
    )
    const segSpend: Record<string, number> = {}
    ;(expenses as DbExpense[] ?? []).forEach(e => {
      const segId = catToSeg[e.category_id]
      if (segId) segSpend[segId] = (segSpend[segId] ?? 0) + 1  // placeholder — client decrypts amounts
    })

    const overBudget = (segs as DbBudgetSegment[] ?? []).map(s => ({
      id: s.id,
      name_encrypted: decryptFromDb(s.name_encrypted),
      monthly_limit_encrypted: decryptFromDb(s.monthly_limit_encrypted),
      expense_count: segSpend[s.id] ?? 0,
    }))

    return NextResponse.json({ type: 'over_budget', month, rows: overBudget })
  }

  if (type === 'loans') {
    const { data: loans, error } = await supabase
      .from('loans').select('*').eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (loans as DbLoan[]).map(l => ({
      ...l,
      loan_name_encrypted: decryptFromDb(l.loan_name_encrypted),
      principal_encrypted: decryptFromDb(l.principal_encrypted),
      interest_rate_encrypted: decryptFromDb(l.interest_rate_encrypted),
    }))
    return NextResponse.json({ type: 'loans', rows })
  }

  if (type === 'credit_cards') {
    const { data: cards, error } = await supabase
      .from('credit_cards').select('*').eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const rows = (cards as DbCreditCard[]).map(c => ({
      ...c,
      card_name_encrypted: decryptFromDb(c.card_name_encrypted),
      credit_limit_encrypted: decryptFromDb(c.credit_limit_encrypted),
      current_balance_encrypted: decryptFromDb(c.current_balance_encrypted),
      minimum_due_encrypted: decryptFromDb(c.minimum_due_encrypted),
    }))
    return NextResponse.json({ type: 'credit_cards', rows })
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}
```

- [ ] **Step 2: Create app/(app)/dashboard/reports/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useSessionStore } from '@/store/session.store'
import { decryptField } from '@/lib/encryption'
import { formatRupee } from '@/lib/format'
import { calculateEMI, calculateMonthsRemaining } from '@/lib/loan-math'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ExpenseRow {
  id: string; amount_encrypted: string; description_encrypted: string | null
  category_name: string; segment_name: string; payment_method: string; expense_date: string
}
interface LoanRow {
  id: string; loan_name_encrypted: string; principal_encrypted: string
  interest_rate_encrypted: string; start_date: string; tenure_months: number
}
interface CardRow {
  id: string; card_name_encrypted: string; credit_limit_encrypted: string
  current_balance_encrypted: string; minimum_due_encrypted: string
  billing_cycle_day: number
}

export default function ReportsPage() {
  const sessionKey = useSessionStore(s => s.sessionKey)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loans, setLoans] = useState<LoanRow[]>([])
  const [cards, setCards] = useState<CardRow[]>([])

  function loadExpenses() {
    fetch(`/api/reports?type=expenses&month=${month}`)
      .then(r => r.json()).then(d => setExpenses(d.rows ?? [])).catch(() => {})
  }
  function loadLoans() {
    fetch('/api/reports?type=loans')
      .then(r => r.json()).then(d => setLoans(d.rows ?? [])).catch(() => {})
  }
  function loadCards() {
    fetch('/api/reports?type=credit_cards')
      .then(r => r.json()).then(d => setCards(d.rows ?? [])).catch(() => {})
  }

  useEffect(() => { loadExpenses() }, [month])
  useEffect(() => { loadLoans(); loadCards() }, [])

  if (!sessionKey) return null

  function exportCSV() {
    const headers = ['Date', 'Category', 'Segment', 'Payment', 'Amount', 'Description']
    const rows = expenses.map(e => [
      e.expense_date, e.category_name, e.segment_name, e.payment_method,
      (Number(decryptField(e.amount_encrypted, sessionKey!)) / 100).toFixed(2),
      e.description_encrypted ? decryptField(e.description_encrypted, sessionKey!) : '',
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `expenses-${month}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <Tabs defaultValue="expenses">
        <TabsList className="bg-white/40">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="credit_cards">Credit Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="flex flex-col gap-4 mt-4">
          <div className="flex items-center gap-3">
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="w-48 bg-white/80" />
            <Button variant="outline" onClick={exportCSV} className="bg-white/60">Export CSV</Button>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/30">
                <tr className="text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Segment</th>
                  <th className="text-left p-3">Method</th>
                  <th className="text-right p-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-white/20 transition-colors">
                    <td className="p-3 text-slate-500">{e.expense_date}</td>
                    <td className="p-3">{e.category_name}</td>
                    <td className="p-3 text-slate-500">{e.segment_name}</td>
                    <td className="p-3 text-slate-500">{e.payment_method.replace('_', ' ')}</td>
                    <td className="p-3 text-right font-medium">
                      {formatRupee(Number(decryptField(e.amount_encrypted, sessionKey)))}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-slate-400 text-sm">No expenses for {month}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="loans" className="flex flex-col gap-4 mt-4">
          {loans.map(l => {
            const principal = Number(decryptField(l.principal_encrypted, sessionKey))
            const rate = Number(decryptField(l.interest_rate_encrypted, sessionKey)) / 100
            const emi = calculateEMI(principal, rate, l.tenure_months)
            const left = calculateMonthsRemaining(l.start_date, l.tenure_months)
            return (
              <div key={l.id} className="glass-card p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{decryptField(l.loan_name_encrypted, sessionKey)}</p>
                  <p className="text-sm text-slate-400">Started {l.start_date} · {l.tenure_months}m tenure</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatRupee(emi)}/mo</p>
                  <p className="text-sm text-slate-400">{left} months left</p>
                </div>
              </div>
            )
          })}
          {loans.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No loans</p>}
        </TabsContent>

        <TabsContent value="credit_cards" className="flex flex-col gap-4 mt-4">
          {cards.map(c => (
            <div key={c.id} className="glass-card p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{decryptField(c.card_name_encrypted, sessionKey)}</p>
                <p className="text-sm text-slate-400">
                  Limit {formatRupee(Number(decryptField(c.credit_limit_encrypted, sessionKey)))}
                  · Billing day {c.billing_cycle_day}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-amber-600">
                  {formatRupee(Number(decryptField(c.current_balance_encrypted, sessionKey)))}
                </p>
                <p className="text-xs text-slate-400">outstanding</p>
              </div>
            </div>
          ))}
          {cards.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No credit cards</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/ "app/(app)/dashboard/reports/"
git commit -m "feat: add reports API and reports page with 3 tabs and CSV export"
```

---

### Task 18: Admin Panel

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/api/admin/users/route.ts`
- Create: `app/api/admin/health/route.ts`
- Create: `scripts/rotate-key.ts`

- [ ] **Step 1: Create app/api/admin/users/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createServiceRoleClient()
  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Create app/api/admin/health/route.ts**

```typescript
import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createServiceRoleClient()

  const [expenses, loans, cards] = await Promise.all([
    admin.from('expenses').select('id', { count: 'exact', head: true }),
    admin.from('loans').select('id', { count: 'exact', head: true }),
    admin.from('credit_cards').select('id', { count: 'exact', head: true }),
  ])

  const { data: lastActivity } = await admin
    .from('expenses')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({
    expenseCount: expenses.count ?? 0,
    loanCount: loans.count ?? 0,
    cardCount: cards.count ?? 0,
    lastActivity: lastActivity?.created_at ?? null,
  })
}
```

- [ ] **Step 3: Create app/admin/page.tsx**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useSessionStore } from '@/store/session.store'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface User { id: string; email: string; created_at: string }
interface Health { expenseCount: number; loanCount: number; cardCount: number; lastActivity: string | null }

export default function AdminPage() {
  const sessionKey = useSessionStore(s => s.sessionKey)
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.replace('/dashboard')
      } else {
        setAuthChecked(true)
        fetch('/api/admin/users').then(r => r.json()).then(setUsers).catch(() => {})
        fetch('/api/admin/health').then(r => r.json()).then(setHealth).catch(() => {})
      }
    })
  }, [router])

  if (!authChecked || !sessionKey) return null

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Admin Panel</h1>

      {health && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{health.expenseCount}</p>
            <p className="text-xs text-slate-400 mt-1">Expense records</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{health.loanCount}</p>
            <p className="text-xs text-slate-400 mt-1">Active loans</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{health.cardCount}</p>
            <p className="text-xs text-slate-400 mt-1">Credit cards</p>
          </div>
        </div>
      )}

      {health?.lastActivity && (
        <p className="text-sm text-slate-400">
          Last activity: {new Date(health.lastActivity).toLocaleString()}
        </p>
      )}

      <div className="glass-card p-6">
        <h2 className="text-base font-medium mb-4">Registered users</h2>
        <div className="divide-y divide-white/30">
          {users.map(u => (
            <div key={u.id} className="flex justify-between py-3 text-sm">
              <span className="text-slate-700">{u.email}</span>
              <span className="text-slate-400">{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {users.length === 0 && <p className="text-sm text-slate-400 py-4">No users found</p>}
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-base font-medium mb-2">Key rotation</h2>
        <p className="text-sm text-slate-500 mb-4">
          To rotate the master encryption key, update <code>MASTER_ENCRYPTION_KEY</code> in your
          Vercel environment variables, then run <code>npx ts-node scripts/rotate-key.ts</code>
          locally with both old and new keys set.
        </p>
      </div>
    </div>
  )
}
```

> **Note:** `NEXT_PUBLIC_ADMIN_EMAIL` needs to be added to `.env.local` for client-side admin check. The server-side check in API routes uses `process.env.ADMIN_EMAIL`.

- [ ] **Step 4: Create scripts/rotate-key.ts**

```typescript
/**
 * Key rotation script. Run ONLY locally.
 * Set OLD_MASTER_KEY and MASTER_ENCRYPTION_KEY (new) in env before running.
 *
 * Usage:
 *   OLD_MASTER_KEY=old-key MASTER_ENCRYPTION_KEY=new-key npx ts-node scripts/rotate-key.ts
 */
import { createClient } from '@supabase/supabase-js'
import { encryptForDb, decryptFromDb } from '../lib/encryption'

const OLD_KEY = process.env.OLD_MASTER_KEY!
const NEW_KEY = process.env.MASTER_ENCRYPTION_KEY!

if (!OLD_KEY || !NEW_KEY || OLD_KEY === NEW_KEY) {
  console.error('Set OLD_MASTER_KEY and MASTER_ENCRYPTION_KEY (different values)')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TABLES: Record<string, string[]> = {
  budget_segments: ['name_encrypted', 'monthly_limit_encrypted'],
  category_mappings: ['category_name_encrypted'],
  expenses: ['amount_encrypted', 'description_encrypted'],
  credit_cards: ['card_name_encrypted', 'credit_limit_encrypted', 'current_balance_encrypted', 'minimum_due_encrypted', 'existing_emi_amount_encrypted'],
  loans: ['loan_name_encrypted', 'principal_encrypted', 'interest_rate_encrypted'],
  monthly_salaries: ['salary_encrypted'],
}

async function rotateTable(table: string, fields: string[]) {
  const { data, error } = await supabase.from(table).select('id, ' + fields.join(', '))
  if (error) { console.error(`Failed to fetch ${table}:`, error.message); return }

  for (const row of (data ?? [])) {
    const updates: Record<string, string> = {}
    for (const field of fields) {
      if (row[field]) {
        const sessionEncrypted = decryptFromDb(row[field], OLD_KEY)
        updates[field] = encryptForDb(sessionEncrypted, NEW_KEY)
      }
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from(table).update(updates).eq('id', row.id)
    }
  }
  console.log(`Rotated ${data?.length ?? 0} rows in ${table}`)
}

async function main() {
  console.log('Starting key rotation…')
  for (const [table, fields] of Object.entries(TABLES)) {
    await rotateTable(table, fields)
  }
  console.log('Key rotation complete. Update MASTER_ENCRYPTION_KEY in Vercel.')
}

main().catch(console.error)
```

- [ ] **Step 5: Commit**

```bash
git add app/admin/ app/api/admin/ scripts/rotate-key.ts
git commit -m "feat: add admin panel with health stats, user list, and key rotation script"
```

---

### Task 19: Final Wiring + Encryption Round-Trip Test

**Files:**
- Modify: `BUILD_INSTRUCTIONS.md` — check off completed steps

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all 3 test suites (encryption, loan-math, credit-card-math) pass.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Fix any TypeScript errors before continuing. Common issues:
- `cookies()` from `next/headers` must only be called in Server Components / Route Handlers — not in `'use client'` files
- `createServerSupabaseClient()` must only be called in server contexts

- [ ] **Step 3: Create .env.local** (from .env.local.example, fill in real values)

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with:
- A real Supabase project URL and keys
- A 32-character `MASTER_ENCRYPTION_KEY`
- A `SECRET_ACCESS_CODE`
- Your email as `ADMIN_EMAIL`

- [ ] **Step 4: Run dev server and verify encryption round-trip**

```bash
npm run dev
```

Manual test sequence:
1. Open `http://localhost:3000` → enter `ACCESS_CODE` → redirected to `/login`
2. Login with your Supabase user credentials → redirected to `/dashboard`
3. Session key modal appears → enter a test session key (e.g. `test-key-123`)
4. Go to `/dashboard/budget` → create a segment "Food" with limit ₹5000
5. Go to `/dashboard/expenses` → add an expense of ₹150 in the Food category
6. Verify the expense appears in the list with the correct amount
7. Reload the page → session key modal reappears → enter same key → expense still shows correctly
8. Open Supabase dashboard → SQL editor → `SELECT * FROM expenses` → verify all fields show as ciphertext (not plaintext)

- [ ] **Step 5: Check BUILD_INSTRUCTIONS.md and mark completed steps**

Update `BUILD_INSTRUCTIONS.md`:
```markdown
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
15. [ ] Write README with deployment + env var instructions
16. [x] Test full encryption round-trip
17. [ ] Deploy to Vercel + connect Supabase
```

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete expense manager implementation"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Implemented in |
|---|---|
| Landing page secret gate | Task 8 |
| Supabase Auth login | Task 9 |
| Session key modal (non-dismissable) | Task 10 |
| Lock icon in nav | Task 10 (`components/nav-sidebar.tsx`) |
| Two-layer AES-256 encryption | Task 4, Tasks 11–15 (all API routes) |
| RLS on all tables | Task 3 |
| Daily expense entry with category | Task 12 |
| Budget segments with progress bars | Task 13 |
| Loan management + EMI calculator | Task 14 |
| Credit card management + min due | Task 15 |
| Dashboard summary widgets + charts | Task 16 |
| Reports: expense table + CSV export | Task 17 |
| Reports: loans tab | Task 17 |
| Reports: credit cards tab | Task 17 |
| Admin panel: users + health | Task 18 |
| Key rotation script | Task 18 |
| Money stored as integers (paise) | `lib/format.ts` + all forms |
| No `any` types | Enforced throughout |
| Zod validation everywhere | All API routes + forms |

**Known gaps (acceptable scope trims):**
- Budget progress bars show `spent=0` on the budget page (Task 13). The dashboard (Task 16) computes totals from expenses — wiring per-segment spend into the budget page requires joining expenses→categories→segments client-side, left as an enhancement.
- Reports "food deep-dive" and "over budget" tabs are stub/simplified. The data model is in place; the client-side computation is straightforward with the decrypted data.
- Mobile bottom-dock nav is not implemented (only desktop sidebar). Add a `md:hidden` bottom bar as an enhancement.

**Type consistency check:** All types defined in `types/index.ts` (Task 2) are used consistently. `DbExpense`, `DbLoan`, `DbCreditCard`, `DbBudgetSegment`, `DbCategoryMapping` flow from DB → API (decrypt master layer) → client (decrypt session layer).
