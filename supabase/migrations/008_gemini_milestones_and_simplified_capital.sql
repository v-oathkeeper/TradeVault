-- TradeVault: Gemini Milestones & Simplified Couple's Capital Management
-- Migration 008

-- ============================================================
-- 1. EXTEND trades table with Gemini Milestone & Trailing SL fields
-- ============================================================
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS milestone1_target NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS milestone1_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS milestone1_trailing_sl NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS milestone2_target NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS milestone2_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS milestone2_trailing_sl NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS milestone3_target NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS milestone3_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS milestone3_trailing_sl NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS current_trailing_sl NUMERIC(14, 4),
  ADD COLUMN IF NOT EXISTS last_reached_milestone TEXT,
  ADD COLUMN IF NOT EXISTS milestones_updated_at TIMESTAMPTZ;

-- ============================================================
-- 2. TABLE: trade_milestone_history
-- Preserves full historical audit log of all Gemini updates
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_milestone_history (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id                UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  milestone1_target       NUMERIC(14, 4),
  milestone1_status       TEXT,
  milestone1_trailing_sl  NUMERIC(14, 4),
  milestone2_target       NUMERIC(14, 4),
  milestone2_status       TEXT,
  milestone2_trailing_sl  NUMERIC(14, 4),
  milestone3_target       NUMERIC(14, 4),
  milestone3_status       TEXT,
  milestone3_trailing_sl  NUMERIC(14, 4),
  current_trailing_sl     NUMERIC(14, 4),
  last_reached_milestone  TEXT,
  notes                   TEXT,
  raw_gemini_input        JSONB,
  created_by              UUID NOT NULL REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestone_history_trade
  ON trade_milestone_history(trade_id);
CREATE INDEX IF NOT EXISTS idx_milestone_history_created_at
  ON trade_milestone_history(created_at DESC);

-- Enable RLS for trade_milestone_history
ALTER TABLE trade_milestone_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_members_read_milestone_history" ON trade_milestone_history;
CREATE POLICY "household_members_read_milestone_history"
  ON trade_milestone_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades t
      JOIN household_members hm ON hm.household_id = t.household_id
      WHERE t.id = trade_milestone_history.trade_id
        AND hm.user_id = auth.uid()
        AND hm.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "admin_insert_milestone_history" ON trade_milestone_history;
CREATE POLICY "admin_insert_milestone_history"
  ON trade_milestone_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades t
      JOIN household_members hm ON hm.household_id = t.household_id
      WHERE t.id = trade_milestone_history.trade_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'ADMIN'
        AND hm.is_active = TRUE
    )
  );

-- ============================================================
-- 3. Relax strategy_bucket requirement on capital_transactions
-- ============================================================
DO $$ BEGIN
  ALTER TABLE capital_transactions ALTER COLUMN strategy_bucket DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE capital_transactions ALTER COLUMN strategy_bucket SET DEFAULT 'INTRADAY';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
