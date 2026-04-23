# Personal Expense Management System — Full Specification
_Saved: 2026-04-18_

## Project Overview
Build a production-ready Personal Expense Management web app deployed on Vercel (free tier)
with Supabase as the database. The app is private-by-design: the repo is public on GitHub
but the app requires authentication and two-layer data encryption.

---

## Tech Stack
- Framework   : Next.js 14+ (App Router) with TypeScript
- Database    : Supabase (PostgreSQL + Auth + Row Level Security)
- Deployment  : Vercel (free tier)
- Styling     : Tailwind CSS + shadcn/ui
- Encryption  : crypto-js (AES-256 for data), bcrypt for key hashing
- State       : Zustand (for session-level encrypted state)
- Charts      : Recharts

---

## Security Architecture — Two-Layer Encryption

### Layer 1 — Admin Encryption Key (Program Layer)
- Admin sets a master AES-256 encryption key via /admin panel
- This key is stored as a Supabase environment secret (never in the repo)
- All data written to Supabase DB is encrypted with this key at the API route level
- This protects data even if the Supabase dashboard is accessed directly

### Layer 2 — User Session Key (Per-User)
- After login, a popup prompts the user to enter their personal KEY
- This KEY exists only in the user's memory / password manager — it is NEVER stored
- Data is doubly-encrypted: first with the admin key, then with the user's session key
- The session key lives only in Zustand memory (cleared on tab close / logout)
- If the user forgets their key, their data is permanently inaccessible (by design)

### Implementation Rules
- NEVER store the user session key in localStorage, sessionStorage, or DB
- NEVER log encryption keys in console or server logs
- All Supabase queries must go through Next.js API routes (never call Supabase directly
  from the client with the service role key)
- Use Row Level Security (RLS) on all Supabase tables

---

## Route Structure

```
/                          → Landing page with secret access input
/login                     → Supabase Auth login (email + password)
/dashboard                 → Home — session key popup on first visit
/dashboard/expenses        → Add / view daily expenses
/dashboard/budget          → Monthly budget by segment
/dashboard/loans           → Loan management + EMI calculator
/dashboard/credit-cards    → Credit card management
/dashboard/reports         → Monthly reports, category mapping, charts
/admin                     → Admin panel (single admin user, set by env var ADMIN_EMAIL)
```

---

## Page 1 — Landing Page with Secret Gate

- Full-screen minimal page with a single centered input box
- Admin sets a SECRET_ACCESS_CODE in Supabase env / .env.local
- User must type the exact code → button click navigates to /login
- Wrong code → show generic error, no hint about what the code is
- This page has NO auth, NO session — it is purely a soft gate
- The access code is verified server-side via a POST /api/verify-access-code route

---

## Authentication (/login)

- Use Supabase Auth (email + password)
- After successful login → redirect to /dashboard
- On /dashboard first load → show a modal asking for the user's personal KEY
- The KEY popup cannot be dismissed — it is required to decrypt any data
- Store the decrypted session key in Zustand store (memory only)
- Add a lock icon in the navbar — clicking it clears the session key and shows the
  KEY popup again (re-lock without logging out)

---

## Database Schema (Supabase — all values stored encrypted)

### profiles
- id (uuid, FK → auth.users)
- email
- created_at

### budget_segments
- id, user_id, name (e.g. Food, Transport, Loan), monthly_limit_encrypted,
  color_tag, created_at

### category_mappings
- id, user_id, category_name_encrypted (e.g. Juice, Steak),
  segment_id (FK → budget_segments), created_at

### expenses
- id, user_id, amount_encrypted, category_id, payment_method (cash/debit/credit_card),
  credit_card_id (nullable), description_encrypted, expense_date, created_at

### credit_cards
- id, user_id, card_name_encrypted, credit_limit_encrypted, billing_cycle_day,
  interest_free_days (default 45), current_balance_encrypted, minimum_due_encrypted,
  existing_emi_count, existing_emi_amount_encrypted, created_at

### loans
- id, user_id, loan_name_encrypted, principal_encrypted, interest_rate_encrypted,
  start_date, tenure_months, emi_amount_encrypted, segment_id, created_at

### monthly_salaries
- id, user_id, month (YYYY-MM), salary_encrypted, created_at

---

## Feature: Daily Expense Entry

Form fields:
- Amount (number)
- Category — searchable dropdown from category_mappings
  → If category not found → option to create new and assign to a segment
- Date (default today)
- Payment method: Cash / Debit Card / Credit Card
  → If Credit Card selected → show credit card selector dropdown
- Description (optional)
- Submit → encrypt both layers → POST /api/expenses

Display: Paginated list of today's + this week's expenses grouped by date.
Each row shows: date, category, amount, payment badge (color-coded).

---

## Feature: Budget Management

- Create segments (e.g. Food, Transport, Entertainment, Fixed Costs, Loan)
- Set monthly budget per segment
- Dashboard shows:
  → Segment cards with progress bar (spent / budget)
  → Color: green < 70%, amber 70–90%, red > 90%
  → "Over budget" alert if any segment exceeds limit
- Fixed Costs segment: special sub-type for recurring monthly expenses (rent, subscriptions)

---

## Feature: Category Mapping

- Admin/user creates categories and maps them to segments
- Example: "Juice" → Food segment, "Gym" → Health segment
- When adding an expense, autocomplete searches categories
- Report view shows breakdown by both category and segment

---

## Feature: Loan Management

Each loan record stores:
- Loan name, principal, annual interest rate (%), start date, tenure (months)
- Linked segment (deducted from Fixed Costs or Loan segment budget)

Auto-calculations (computed at display time, not stored):
- Monthly EMI = P × r × (1+r)^n / ((1+r)^n − 1)  where r = monthly rate, n = months
- Total interest payable = (EMI × n) − Principal
- Days remaining = calculate from start_date + tenure vs today
- Months remaining = (start_date + tenure_months) − current month
- Percentage of salary consumed by all loans = (sum of all EMIs / monthly salary) × 100
- Interest paid to date = total payments made − principal paid to date

Reports:
- Loan summary card per loan: name, EMI, months left, % salary consumed
- Total loan burden chart (pie: principal vs interest)
- Upcoming payment calendar (next 3 months EMI schedule)

---

## Feature: Credit Card Management

Each card stores:
- Card name, credit limit, billing cycle day, interest-free period (default 45 days)
- Current outstanding balance
- Minimum due amount
- Existing EMIs on the card (count + monthly EMI amount)
- Any carried-over balance from previous month

Auto-calculations:
- Interest-free period: from transaction date, calculate last date to pay without interest
- Minimum due = max(5% of outstanding balance, ₹200) — configurable per card
- Total minimum due = outstanding balance EMIs + minimum due on revolving balance
- If expense is added via credit card → update card's current balance
- Alert if payment due date is within 5 days

Display:
- Card summary panel: limit, used, available, next due date, minimum due
- List of transactions on each card this month

---

## Dashboard Home (/dashboard)

Summary widgets (top row):
- This month total spent
- Budget remaining (overall)
- Total active loans EMI
- Credit card dues this month

Quick-add expense button (floating action button)

Charts:
- Weekly spending bar chart (last 4 weeks)
- Segment-wise donut chart (current month)
- Loan repayment progress bars

---

## Reports (/dashboard/reports)

### Monthly Expense Report
- Filter by month + year
- Table: category → amount → segment → payment method
- Export to CSV (client-side)

### Food Report (example segment deep-dive)
- All food expenses this month
- Sub-breakdown by category (Juice, Restaurant, Groceries, etc.)
- Day-by-day sparkline

### Over Budget Report
- All segments that exceeded their monthly limit
- Amount over budget, % over, comparison to last month

### Loan Report
- Total EMI burden, total interest paid (lifetime), months remaining per loan
- Salary consumption % trend (monthly)

### Credit Card Report
- Monthly credit card spend
- Interest-free vs interest-bearing split
- Minimum due history

---

## Admin Panel (/admin)

Accessible only if user email === process.env.ADMIN_EMAIL

Features:
- Set / rotate the master AES-256 encryption key
  (rotating key will require a migration script — scaffold it as /scripts/rotate-key.ts)
- View registered users (email + join date only — no decrypted data)
- Set / update the landing page secret access code
- View app health: total records, last activity timestamp

---

## Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only, never exposed to client
ADMIN_EMAIL=                      # single admin user email
MASTER_ENCRYPTION_KEY=            # AES-256 master key (32 chars)
ACCESS_CODE=                      # landing page secret gate code
NEXTAUTH_SECRET=                  # or use Supabase JWT secret
```

---

## Supabase Setup Instructions

1. Create project at supabase.com
2. Run migrations from /supabase/migrations/*.sql
3. Enable Row Level Security on all tables
4. Add RLS policies: user can only SELECT/INSERT/UPDATE/DELETE own rows
   (WHERE user_id = auth.uid())
5. Set env vars in Vercel dashboard (Settings → Environment Variables)
6. Never commit .env.local to the repo

---

## File Structure

```
/app
  /api
    /verify-access-code/route.ts
    /expenses/route.ts
    /budget/route.ts
    /loans/route.ts
    /credit-cards/route.ts
    /reports/route.ts
  /(auth)
    /login/page.tsx
  /(app)
    /dashboard/page.tsx
    /dashboard/expenses/page.tsx
    /dashboard/budget/page.tsx
    /dashboard/loans/page.tsx
    /dashboard/credit-cards/page.tsx
    /dashboard/reports/page.tsx
  /admin/page.tsx
  /page.tsx                        ← landing page with access gate
/components
  /ui/                             ← shadcn components
  /session-key-modal.tsx
  /expense-form.tsx
  /loan-calculator.tsx
  /credit-card-panel.tsx
  /budget-progress.tsx
  /charts/
/lib
  /encryption.ts                   ← encrypt() / decrypt() helpers
  /supabase.ts                     ← client + server clients
  /loan-math.ts                    ← EMI and loan calculations
  /credit-card-math.ts
/store
  /session.store.ts                ← Zustand: session key in memory only
/supabase
  /migrations/
    /001_initial_schema.sql
/scripts
  /rotate-key.ts
```

---

## Code Quality Rules

- All API routes must validate user session before processing
- All inputs must be sanitized before encryption
- Use Zod for form + API input validation
- Use React Hook Form for all forms
- All money values stored as integers (paise/cents) to avoid float errors
- Dates stored as ISO strings (YYYY-MM-DD)
- All Supabase calls wrapped in try/catch with typed error responses
- TypeScript strict mode enabled
- No `any` types

---

## Build Order

1. Scaffold Next.js + TypeScript + Tailwind + shadcn/ui
2. Set up Supabase project + write migration SQL + enable RLS
3. Build encryption helpers (lib/encryption.ts)
4. Build landing page with access gate
5. Build login page with Supabase Auth
6. Build session key modal + Zustand store
7. Build expense entry form + API route
8. Build budget segments UI + API
9. Build category mapping system
10. Build loan management + EMI calculator
11. Build credit card management + calculations
12. Build dashboard with summary widgets + charts
13. Build reports page (all 5 report types)
14. Build admin panel
15. Write README with deployment + env var instructions
16. Test full encryption round-trip (encrypt → store → fetch → decrypt)
17. Deploy to Vercel + connect Supabase

---

## Design Philosophy: "Frosted Clarity"

### Visual Language
- Atmosphere: Lightweight, ethereal, and organized
- Surface: Soft, blurred backgrounds with brand colors peeking through
- Typography: Soft Sans-serif (Geist or Satoshi), subtle tracking on headers
- Glass Effect: 12px-20px background blur, thin semi-transparent white borders

### Color Palette

| Element | Color / Value |
|---------|---------------|
| Primary Background | `linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)` |
| Glass Card Fill | `rgba(255, 255, 255, 0.7)` |
| Border / Stroke | `rgba(255, 255, 255, 0.5)` |
| Safe (Green) | `#34d399` (Emerald 400) |
| Warning (Amber) | `#fbbf24` (Amber 400) |
| Danger (Red) | `#f87171` (Red 400) |
| Text Primary | `#1e293b` (Slate 800) |

### Tailwind Glass Card Classes
```
bg-white/60 backdrop-blur-lg border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]
```

### Navigation
- Desktop: Floating sidebar that doesn't touch screen edges
- Mobile: Frosted bottom dock with glass blur (content visible scrolling underneath)
- Active States: Soft "inner glow" or slight lift (shadow) — NOT solid colors

### Page-Specific UI

**Secret Gate (/):**
- Single high-gloss white input container
- Glass-morphism depth on input field
- Subtle character glow when typing
- "Liquid" style button — solid white, soft drop shadow

**Session Key Modal (/dashboard):**
- Heavy white blur backdrop (backdrop-blur-xl)
- Dashboard looks frosted until key is entered
- Minimalist input, no heavy borders, clean line
- Prompt text: "Unlocking your financial data..."

**Dashboard Widgets:**
- Frosted glass tiles
- Glassmorphism icons (multi-layered, semi-transparent in blue/green/amber)
- Recharts with soft pastel colors, fill-opacity={0.2} for area charts

### CSS Global Overrides (globals.css)
```css
@layer base {
  .glass-card {
    @apply bg-white/60 backdrop-blur-lg border border-white/40 shadow-sm;
  }
  
  /* Make shadcn dialogs/modals glassy */
  [data-radix-popper-content-wrapper], .fixed.inset-0 {
    @apply backdrop-blur-xl bg-white/30;
  }
}
```
