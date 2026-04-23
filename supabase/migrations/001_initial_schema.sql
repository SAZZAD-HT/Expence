-- =============================================================================
-- 001_initial_schema.sql
-- Initial schema for Personal Expense Manager
-- All sensitive fields store AES-256 ciphertext (double-encrypted at app layer)
-- Money stored as BIGINT (paise/cents); dates as TEXT (ISO YYYY-MM-DD)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles
-- Auto-populated via trigger when auth.users row is created
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. budget_segments
-- name is NOT encrypted — used for display/filtering in queries
-- ---------------------------------------------------------------------------
CREATE TABLE public.budget_segments (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    TEXT        NOT NULL,
  monthly_limit_encrypted TEXT        NOT NULL,
  color_tag               TEXT,
  is_fixed_cost           BOOLEAN     DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.budget_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_segments_select" ON public.budget_segments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "budget_segments_insert" ON public.budget_segments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "budget_segments_update" ON public.budget_segments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "budget_segments_delete" ON public.budget_segments
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. credit_cards
-- Created BEFORE expenses because expenses references this table
-- ---------------------------------------------------------------------------
CREATE TABLE public.credit_cards (
  id                          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_name_encrypted         TEXT        NOT NULL,
  credit_limit_encrypted      TEXT        NOT NULL,
  billing_cycle_day           INTEGER     NOT NULL CHECK (billing_cycle_day BETWEEN 1 AND 31),
  interest_free_days          INTEGER     DEFAULT 45,
  current_balance_encrypted   TEXT        NOT NULL,
  minimum_due_encrypted       TEXT        NOT NULL,
  existing_emi_count          INTEGER     DEFAULT 0,
  existing_emi_amount_encrypted TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_cards_select" ON public.credit_cards
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "credit_cards_insert" ON public.credit_cards
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "credit_cards_update" ON public.credit_cards
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "credit_cards_delete" ON public.credit_cards
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. category_mappings
-- ---------------------------------------------------------------------------
CREATE TABLE public.category_mappings (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name_encrypted TEXT        NOT NULL,
  segment_id              UUID        REFERENCES public.budget_segments(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.category_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_mappings_select" ON public.category_mappings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "category_mappings_insert" ON public.category_mappings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "category_mappings_update" ON public.category_mappings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "category_mappings_delete" ON public.category_mappings
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. expenses
-- Depends on credit_cards and category_mappings (both created above)
-- ---------------------------------------------------------------------------
CREATE TABLE public.expenses (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_encrypted     TEXT        NOT NULL,
  category_id          UUID        REFERENCES public.category_mappings(id) ON DELETE SET NULL,
  payment_method       TEXT        NOT NULL CHECK (payment_method IN ('cash', 'debit_card', 'credit_card')),
  credit_card_id       UUID        REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  description_encrypted TEXT,
  expense_date         TEXT        NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. loans
-- ---------------------------------------------------------------------------
CREATE TABLE public.loans (
  id                      UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_name_encrypted     TEXT        NOT NULL,
  principal_encrypted     TEXT        NOT NULL,
  interest_rate_encrypted TEXT        NOT NULL,
  start_date              TEXT        NOT NULL,
  tenure_months           INTEGER     NOT NULL,
  emi_amount_encrypted    TEXT        NOT NULL,
  segment_id              UUID        REFERENCES public.budget_segments(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans_select" ON public.loans
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "loans_insert" ON public.loans
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "loans_update" ON public.loans
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "loans_delete" ON public.loans
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. monthly_salaries
-- ---------------------------------------------------------------------------
CREATE TABLE public.monthly_salaries (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month            TEXT        NOT NULL,
  salary_encrypted TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, month)
);

ALTER TABLE public.monthly_salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_salaries_select" ON public.monthly_salaries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "monthly_salaries_insert" ON public.monthly_salaries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "monthly_salaries_update" ON public.monthly_salaries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "monthly_salaries_delete" ON public.monthly_salaries
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- Trigger: auto-create profile row when a new auth user is created
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================================
-- Indexes for common query patterns
-- =============================================================================
CREATE INDEX idx_expenses_user_date       ON public.expenses (user_id, expense_date);
CREATE INDEX idx_expenses_user_category   ON public.expenses (user_id, category_id);
CREATE INDEX idx_category_mappings_user_segment ON public.category_mappings (user_id, segment_id);
CREATE INDEX idx_loans_user_segment       ON public.loans (user_id, segment_id);
