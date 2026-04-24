-- =============================================================================
-- 003_procurement_savings.sql
-- Adds:
--   - procurement_items: "future buy" wishlist with a budget per item
--   - savings_goals:     named savings pots with target + current amounts
-- =============================================================================

CREATE TABLE public.procurement_items (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_encrypted         TEXT        NOT NULL,
  budget_encrypted       TEXT        NOT NULL,
  status                 TEXT        NOT NULL DEFAULT 'planned',
  notes_encrypted        TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX procurement_items_user ON public.procurement_items (user_id, created_at DESC);

ALTER TABLE public.procurement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "procurement_items_select" ON public.procurement_items
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "procurement_items_insert" ON public.procurement_items
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "procurement_items_update" ON public.procurement_items
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "procurement_items_delete" ON public.procurement_items
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------

CREATE TABLE public.savings_goals (
  id                       UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_encrypted           TEXT        NOT NULL,
  target_amount_encrypted  TEXT        NOT NULL,
  current_amount_encrypted TEXT        NOT NULL,
  notes_encrypted          TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX savings_goals_user ON public.savings_goals (user_id, created_at DESC);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "savings_goals_select" ON public.savings_goals
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "savings_goals_insert" ON public.savings_goals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "savings_goals_update" ON public.savings_goals
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "savings_goals_delete" ON public.savings_goals
  FOR DELETE USING (user_id = auth.uid());
