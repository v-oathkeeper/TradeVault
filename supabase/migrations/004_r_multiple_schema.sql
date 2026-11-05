-- TradeVault: R-Multiple Tracking & Dynamic Stop-Loss Management
-- Migration 004: Extends trades table and adds stop_loss_history audit table

-- ============================================================
-- EXTEND: trades table with risk management columns
-- ============================================================

-- Initial risk definition (required at trade entry)
ALTER TABLE trades
  ADD COLUMN initial_stop_loss    NUMERIC(14, 4),
  ADD COLUMN initial_risk_per_share NUMERIC(14, 4),
  ADD COLUMN initial_risk_rupees  NUMERIC(16, 4),
  ADD COLUMN initial_risk_pct     NUMERIC(10, 6),  -- percentage of entry price

  -- Optional planned target
  ADD COLUMN planned_target       NUMERIC(14, 4),
  ADD COLUMN planned_rr           NUMERIC(10, 4),  -- planned reward:risk ratio

  -- Computed R-multiple target levels (derived from initial stop)
  ADD COLUMN r1_price             NUMERIC(14, 4),
  ADD COLUMN r2_price             NUMERIC(14, 4),
  ADD COLUMN r3_price             NUMERIC(14, 4),

  -- Setup / strategy tag
  ADD COLUMN strategy_name        TEXT,

  -- Dynamic stop-loss (starts = initial_stop_loss, trails upward)
  ADD COLUMN current_stop_loss    NUMERIC(14, 4),

  -- Max adverse / favorable excursion (updated when current price is logged)
  ADD COLUMN max_adverse_excursion  NUMERIC(14, 4),
  ADD COLUMN max_favorable_excursion NUMERIC(14, 4),

  -- Realized R-multiples (computed on trade close)
  ADD COLUMN realized_r_multiple  NUMERIC(10, 4),
  ADD COLUMN gross_r_multiple     NUMERIC(10, 4);

-- Business-rule constraints for stop-loss direction
ALTER TABLE trades
  ADD CONSTRAINT chk_long_stop_below_entry
    CHECK (
      direction <> 'LONG'
      OR initial_stop_loss IS NULL
      OR initial_stop_loss < entry_price
    ),
  ADD CONSTRAINT chk_short_stop_above_entry
    CHECK (
      direction <> 'SHORT'
      OR initial_stop_loss IS NULL
      OR initial_stop_loss > entry_price
    );

-- Index for strategy-based queries
CREATE INDEX idx_trades_strategy ON trades(strategy_name) WHERE strategy_name IS NOT NULL;

-- ============================================================
-- ENUM: stop_loss_update_type
-- ============================================================
DO $$ BEGIN
  CREATE TYPE stop_loss_update_type AS ENUM (
    'INITIAL',       -- Set at trade entry
    'TRAIL',         -- Moved in direction of profit
    'BREAKEVEN',     -- Moved to entry price
    'PARTIAL_CLOSE', -- Adjusted after partial position exit
    'MANUAL'         -- Any other admin-initiated adjustment
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: stop_loss_history
-- Full audit trail of every stop-loss change for a trade
-- ============================================================
CREATE TABLE stop_loss_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id        UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  previous_stop   NUMERIC(14, 4),    -- NULL for INITIAL entry
  new_stop        NUMERIC(14, 4) NOT NULL,
  stop_type       stop_loss_update_type NOT NULL DEFAULT 'MANUAL',

  -- Optional: price at which the update was made (for MAE/MFE tracking)
  market_price_at_update NUMERIC(14, 4),

  -- The R-level at the time of this update (for context)
  floating_r_at_update NUMERIC(10, 4),

  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stop_history_trade ON stop_loss_history(trade_id);
CREATE INDEX idx_stop_history_created_at ON stop_loss_history(created_at);

-- ============================================================
-- RLS POLICIES: stop_loss_history
-- ============================================================

-- Enable RLS
ALTER TABLE stop_loss_history ENABLE ROW LEVEL SECURITY;

-- Allow household members to read stop-loss history for their household's trades
CREATE POLICY "household_members_read_stop_history"
  ON stop_loss_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trades t
      JOIN household_members hm ON hm.household_id = t.household_id
      WHERE t.id = stop_loss_history.trade_id
        AND hm.user_id = auth.uid()
        AND hm.is_active = TRUE
    )
  );

-- Only ADMINs can insert stop-loss history
CREATE POLICY "admin_insert_stop_history"
  ON stop_loss_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trades t
      JOIN household_members hm ON hm.household_id = t.household_id
      WHERE t.id = stop_loss_history.trade_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'ADMIN'
        AND hm.is_active = TRUE
    )
  );

-- ============================================================
-- VIEW: v_trades_with_risk
-- Convenience view joining trades with their latest stop-loss
-- ============================================================
CREATE OR REPLACE VIEW v_trades_with_risk AS
SELECT
  t.*,
  -- Stop-loss history count for the UI badge
  (SELECT COUNT(*) FROM stop_loss_history slh WHERE slh.trade_id = t.id) AS stop_update_count,
  -- Latest stop-loss update timestamp
  (SELECT MAX(slh.created_at) FROM stop_loss_history slh WHERE slh.trade_id = t.id) AS last_stop_update_at
FROM trades t;
