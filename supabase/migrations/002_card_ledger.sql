-- =============================================================================
-- 002_card_ledger.sql
-- Adds:
--   - card_emis:     installment purchases on a credit card (add post-setup)
--   - card_payments: payments made toward a card's balance
-- All money fields are AES-256 ciphertext (double-encrypted at app layer).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- card_emis
-- Each row is one EMI plan. `months_paid` is incremented as the user records
-- monthly payments. `status` = 'active' | 'closed' (derived from months_paid
-- vs tenure_months by the app; stored so closed ones can be hidden).
-- ---------------------------------------------------------------------------
CREATE TABLE public.card_emis (
  id                        UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id                   UUID        NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  name_encrypted            TEXT        NOT NULL,
  principal_encrypted       TEXT        NOT NULL,
  monthly_amount_encrypted  TEXT        NOT NULL,
  tenure_months             INT         NOT NULL CHECK (tenure_months > 0),
  months_paid               INT         NOT NULL DEFAULT 0,
  start_date                TEXT        NOT NULL,
  status                    TEXT        NOT NULL DEFAULT 'active',
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX card_emis_user_card ON public.card_emis (user_id, card_id);

ALTER TABLE public.card_emis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_emis_select" ON public.card_emis
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "card_emis_insert" ON public.card_emis
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "card_emis_update" ON public.card_emis
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "card_emis_delete" ON public.card_emis
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- card_payments
-- Each row is one payment toward a card's balance. Amount is encrypted.
-- The app reduces credit_cards.current_balance_encrypted on insert.
-- ---------------------------------------------------------------------------
CREATE TABLE public.card_payments (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id           UUID        NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  amount_encrypted  TEXT        NOT NULL,
  payment_date      TEXT        NOT NULL,
  note_encrypted    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX card_payments_user_card ON public.card_payments (user_id, card_id);
CREATE INDEX card_payments_date ON public.card_payments (payment_date DESC);

ALTER TABLE public.card_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_payments_select" ON public.card_payments
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "card_payments_insert" ON public.card_payments
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "card_payments_update" ON public.card_payments
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "card_payments_delete" ON public.card_payments
  FOR DELETE USING (user_id = auth.uid());
