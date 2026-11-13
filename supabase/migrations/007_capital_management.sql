-- TradeVault: Capital & Profit Management Module
-- Migration 007: Capital transaction ledger with strategy buckets
-- 
-- Design decisions:
-- 1. trade_type='INTRADAY' maps to strategy_bucket='INTRADAY'
--    trade_type='DELIVERY' maps to strategy_bucket='SWING'
--    This mapping is explicit and documented here — no silent reclassification.
-- 2. Net realized P&L is derived from trades.net_pnl (single source of truth).
--    We do NOT store a separate cumulative P&L — avoids dual-source drift.
-- 3. capital_transactions is append-only/immutable. Corrections via reversal records.
-- 4. All monetary amounts use NUMERIC(16,2) — no floating point.

-- ============================================================
-- ENUM: capital_tx_type
-- ============================================================
DO $$ BEGIN
  CREATE TYPE capital_tx_type AS ENUM (
    'INITIAL_ALLOCATION',   -- First capital setup for owner+strategy
    'CAPITAL_CONTRIBUTION', -- Additional capital added by admin
    'CAPITAL_ADJUSTMENT',   -- Admin correction with audit trail
    'CAPITAL_WITHDRAWAL',   -- Withdrawal from contributed capital
    'PROFIT_WITHDRAWAL'     -- Withdrawal from realized trading profits
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- ENUM: strategy_bucket
-- Explicit alias: INTRADAY = MIS, SWING = CNC/DELIVERY
-- ============================================================
DO $$ BEGIN
  CREATE TYPE strategy_bucket AS ENUM (
    'INTRADAY',  -- MIS trades (trade_type = 'INTRADAY')
    'SWING'      -- CNC/DELIVERY trades (trade_type = 'DELIVERY')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: capital_transactions
-- Immutable ledger of all capital events per owner+strategy.
-- Do NOT delete records. Use reversal_of to correct errors.
-- ============================================================
CREATE TABLE IF NOT EXISTS capital_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id      UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
  portfolio_owner_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  strategy_bucket   strategy_bucket NOT NULL,
  tx_type           capital_tx_type NOT NULL,

  -- Amount is always stored as a positive number.
  -- The semantic of + or - is determined by tx_type:
  --   INITIAL_ALLOCATION, CAPITAL_CONTRIBUTION, CAPITAL_ADJUSTMENT (can be +/- via sign)
  --   CAPITAL_WITHDRAWAL and PROFIT_WITHDRAWAL reduce balances
  -- For CAPITAL_ADJUSTMENT, 'amount' stores |delta|; sign stored in adjustment_diff.
  amount            NUMERIC(16,2) NOT NULL CHECK (amount > 0),

  tx_date           DATE NOT NULL,
  created_by        UUID NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes             TEXT,

  -- Reversal support: when correcting an error, insert a new record
  -- with reversal_of pointing to the original. The original is NOT deleted.
  reversal_of       UUID REFERENCES capital_transactions(id),

  -- Idempotency: prevents duplicate form submissions
  idempotency_key   TEXT UNIQUE,

  -- CAPITAL_ADJUSTMENT audit trail
  previous_amount   NUMERIC(16,2),   -- contributed capital before adjustment
  new_amount        NUMERIC(16,2),   -- contributed capital after adjustment
  adjustment_diff   NUMERIC(16,2),   -- signed delta (new - old), can be negative

  -- Constraint: reversal records should reference a valid tx in same household
  CONSTRAINT chk_reversal_same_household CHECK (
    reversal_of IS NULL OR
    household_id = (SELECT household_id FROM capital_transactions ref WHERE ref.id = reversal_of)
  )
);

-- ============================================================
-- INDEXES for query performance
-- ============================================================

-- Primary query: portfolio summary per owner+strategy
CREATE INDEX idx_capital_tx_owner_strategy
  ON capital_transactions(portfolio_owner_id, strategy_bucket);

-- Household-scoped queries (RLS + summary)
CREATE INDEX idx_capital_tx_household
  ON capital_transactions(household_id);

-- Chronological history view
CREATE INDEX idx_capital_tx_date
  ON capital_transactions(tx_date DESC);

-- Reversal lookup
CREATE INDEX idx_capital_tx_reversal
  ON capital_transactions(reversal_of)
  WHERE reversal_of IS NOT NULL;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE capital_transactions ENABLE ROW LEVEL SECURITY;

-- All household members can read capital data (dashboard cards)
CREATE POLICY "cap_tx_select"
  ON capital_transactions
  FOR SELECT
  USING (household_id = get_my_household_id());

-- Only ADMIN can insert capital transactions
CREATE POLICY "cap_tx_insert_admin"
  ON capital_transactions
  FOR INSERT
  WITH CHECK (household_id = get_my_household_id() AND is_admin());

-- No UPDATE policy — records are immutable; use reversals
-- No DELETE policy — records are permanent audit trail

-- ============================================================
-- HELPER: strategy_bucket_for_trade_type
-- Canonical mapping function used by application code
-- and can be used in SQL queries for consistency.
-- INTRADAY → INTRADAY, DELIVERY → SWING
-- ============================================================
CREATE OR REPLACE FUNCTION strategy_bucket_for_trade_type(p_trade_type trade_type)
RETURNS strategy_bucket
LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE p_trade_type
    WHEN 'INTRADAY' THEN 'INTRADAY'::strategy_bucket
    WHEN 'DELIVERY' THEN 'SWING'::strategy_bucket
    ELSE NULL
  END;
$$;

-- ============================================================
-- VIEW: v_portfolio_pnl_summary
-- Derives cumulative realized net P&L per owner+strategy
-- from the canonical trades table. This is the single source of
-- truth for P&L — we never store a separate aggregate.
-- ============================================================
CREATE OR REPLACE VIEW v_portfolio_pnl_summary AS
SELECT
  t.household_id,
  t.portfolio_owner_id,
  strategy_bucket_for_trade_type(t.trade_type)   AS strategy_bucket,
  COUNT(*)                                         AS closed_trade_count,
  COALESCE(SUM(t.net_pnl), 0)                    AS cumulative_net_realized_pnl
FROM trades t
WHERE t.status = 'CLOSED'
  AND t.net_pnl IS NOT NULL
GROUP BY
  t.household_id,
  t.portfolio_owner_id,
  strategy_bucket_for_trade_type(t.trade_type);

-- ============================================================
-- VIEW: v_capital_summary
-- Full capital accounting summary per owner+strategy.
-- Joins capital_transactions ledger with trade P&L view.
-- Formulas:
--   contributed_capital = SUM(INITIAL + CONTRIBUTION + ADJUSTMENT_DIFF) - SUM(CAPITAL_WITHDRAWAL)
--   cumulative_profit_withdrawals = SUM(PROFIT_WITHDRAWAL amount)
--   current_capital = contributed_capital + cumulative_net_realized_pnl - cumulative_profit_withdrawals
--   available_profit = MAX(0, cumulative_net_realized_pnl - cumulative_profit_withdrawals)
-- ============================================================
CREATE OR REPLACE VIEW v_capital_summary AS
WITH ledger AS (
  SELECT
    ct.household_id,
    ct.portfolio_owner_id,
    ct.strategy_bucket,
    -- Contributed capital: sum of allocations/contributions + net adjustments - capital withdrawals
    COALESCE(SUM(CASE
      WHEN ct.tx_type IN ('INITIAL_ALLOCATION', 'CAPITAL_CONTRIBUTION')
        THEN ct.amount
      WHEN ct.tx_type = 'CAPITAL_ADJUSTMENT'
        THEN ct.adjustment_diff  -- signed delta
      WHEN ct.tx_type = 'CAPITAL_WITHDRAWAL'
        THEN -ct.amount
      ELSE 0
    END), 0) AS contributed_capital,
    -- Profit withdrawals (cumulative)
    COALESCE(SUM(CASE
      WHEN ct.tx_type = 'PROFIT_WITHDRAWAL' THEN ct.amount
      ELSE 0
    END), 0) AS cumulative_profit_withdrawals,
    -- Capital withdrawals (cumulative, for display)
    COALESCE(SUM(CASE
      WHEN ct.tx_type = 'CAPITAL_WITHDRAWAL' THEN ct.amount
      ELSE 0
    END), 0) AS cumulative_capital_withdrawals
  FROM capital_transactions ct
  -- Exclude reversal-source records (reversed transactions are nullified)
  WHERE ct.id NOT IN (
    SELECT reversal_of FROM capital_transactions
    WHERE reversal_of IS NOT NULL
  )
  GROUP BY ct.household_id, ct.portfolio_owner_id, ct.strategy_bucket
),
pnl AS (
  SELECT
    household_id,
    portfolio_owner_id,
    strategy_bucket,
    cumulative_net_realized_pnl,
    closed_trade_count
  FROM v_portfolio_pnl_summary
)
SELECT
  COALESCE(l.household_id, p.household_id)             AS household_id,
  COALESCE(l.portfolio_owner_id, p.portfolio_owner_id) AS portfolio_owner_id,
  COALESCE(l.strategy_bucket, p.strategy_bucket)       AS strategy_bucket,
  COALESCE(l.contributed_capital, 0)                   AS contributed_capital,
  COALESCE(p.cumulative_net_realized_pnl, 0)           AS cumulative_net_realized_pnl,
  COALESCE(l.cumulative_profit_withdrawals, 0)          AS cumulative_profit_withdrawals,
  COALESCE(l.cumulative_capital_withdrawals, 0)         AS cumulative_capital_withdrawals,
  -- available_profit = MAX(0, net_pnl - profit_withdrawals)
  GREATEST(0,
    COALESCE(p.cumulative_net_realized_pnl, 0)
    - COALESCE(l.cumulative_profit_withdrawals, 0)
  )                                                      AS available_profit_for_withdrawal,
  -- current_capital = contributed + net_pnl - profit_withdrawals
  COALESCE(l.contributed_capital, 0)
  + COALESCE(p.cumulative_net_realized_pnl, 0)
  - COALESCE(l.cumulative_profit_withdrawals, 0)         AS current_capital,
  COALESCE(p.closed_trade_count, 0)                     AS closed_trade_count
FROM ledger l
FULL OUTER JOIN pnl p
  ON l.household_id = p.household_id
  AND l.portfolio_owner_id = p.portfolio_owner_id
  AND l.strategy_bucket = p.strategy_bucket;
