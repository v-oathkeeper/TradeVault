-- ============================================================
-- MIGRATION 006: Performance Indexes
-- Optimizes common high-frequency query patterns:
-- 1. Active open positions per household
-- 2. Household trade journal sorted by entry date
-- 3. Household membership verification
-- 4. Portfolio owner filtered views
-- 5. Stop-loss history audit ordering
-- ============================================================

-- 1. Compound index for active open positions per household
CREATE INDEX IF NOT EXISTS idx_trades_household_status_entry 
ON trades(household_id, status, entry_at DESC);

-- 2. Compound index for household trade journal ordered by entry_at
CREATE INDEX IF NOT EXISTS idx_trades_household_entry 
ON trades(household_id, entry_at DESC);

-- 3. Index for user household membership lookup
CREATE INDEX IF NOT EXISTS idx_household_members_user_active 
ON household_members(user_id, is_active);

-- 4. Compound index for portfolio owner and status filtering
CREATE INDEX IF NOT EXISTS idx_trades_owner_status 
ON trades(portfolio_owner_id, status);

-- 5. Stop loss history chronological lookup
CREATE INDEX IF NOT EXISTS idx_stop_loss_history_trade_created 
ON stop_loss_history(trade_id, created_at DESC);
