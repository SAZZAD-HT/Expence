-- =============================================================================
-- 004_cash.sql
-- Adds:
--   - cash_inflows:   log of incoming cash (bonus, freelance, gift, etc.)
--   - cash_balances:  one row per user — the current cash-in-hand amount
-- =============================================================================

CREATE TABLE public.cash_inflows (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_encrypted TEXT        NOT NULL,
  source_encrypted TEXT        NOT NULL,
  note_encrypted   TEXT,
  inflow_date      TEXT        NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX cash_inflows_user_date ON public.cash_inflows (user_id, inflow_date DESC);

ALTER TABLE public.cash_inflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_inflows_select" ON public.cash_inflows
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "cash_inflows_insert" ON public.cash_inflows
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cash_inflows_update" ON public.cash_inflows
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "cash_inflows_delete" ON public.cash_inflows
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------

CREATE TABLE public.cash_balances (
  user_id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_encrypted TEXT        NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cash_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_balances_select" ON public.cash_balances
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "cash_balances_insert" ON public.cash_balances
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "cash_balances_update" ON public.cash_balances
  FOR UPDATE USING (user_id = auth.uid());
