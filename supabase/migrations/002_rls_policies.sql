-- TradeVault: RLS Policies
-- Migration 002: Row Level Security for all tables

-- ============================================================
-- SECURITY DEFINER HELPER FUNCTIONS
-- These avoid recursive RLS policy lookups
-- ============================================================

-- Returns the household_id for the current authenticated user
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM household_members
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Returns the role of the current authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM household_members
  WHERE user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Returns true if current user is ADMIN
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE user_id = auth.uid() AND role = 'ADMIN' AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Returns true if current user is a member of the given household
CREATE OR REPLACE FUNCTION is_household_member(hh_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE user_id = auth.uid() AND household_id = hh_id AND is_active = TRUE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_fee_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_charge_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE demat_charge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_charge_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HOUSEHOLDS
-- Members can view their household; only admin can update
-- ============================================================
CREATE POLICY "households_select" ON households
  FOR SELECT USING (id = get_my_household_id());

CREATE POLICY "households_update_admin" ON households
  FOR UPDATE USING (id = get_my_household_id() AND is_admin());

-- ============================================================
-- PROFILES
-- Users can see their own profile and household members' profiles
-- ============================================================
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (
    id = auth.uid() OR
    id IN (SELECT user_id FROM household_members WHERE household_id = get_my_household_id())
  );

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

-- ============================================================
-- HOUSEHOLD_MEMBERS
-- Members can view their household's member list
-- Only admin can manage members
-- ============================================================
CREATE POLICY "hm_select" ON household_members
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY "hm_insert_admin" ON household_members
  FOR INSERT WITH CHECK (household_id = get_my_household_id() AND is_admin());

CREATE POLICY "hm_update_admin" ON household_members
  FOR UPDATE USING (household_id = get_my_household_id() AND is_admin());

-- ============================================================
-- PERSONS
-- All household members can view; only admin can modify
-- ============================================================
CREATE POLICY "persons_select" ON persons
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY "persons_insert_admin" ON persons
  FOR INSERT WITH CHECK (household_id = get_my_household_id() AND is_admin());

CREATE POLICY "persons_update_admin" ON persons
  FOR UPDATE USING (household_id = get_my_household_id() AND is_admin());

CREATE POLICY "persons_delete_admin" ON persons
  FOR DELETE USING (household_id = get_my_household_id() AND is_admin());

-- ============================================================
-- BROKERS
-- All authenticated users can view (brokers are global)
-- Only admin can modify (via service role for seeding)
-- ============================================================
CREATE POLICY "brokers_select_all" ON brokers
  FOR SELECT USING (get_my_household_id() IS NOT NULL);

-- ============================================================
-- BROKER_FEE_RATES
-- All household members can view; only admin can modify
-- ============================================================
CREATE POLICY "fee_rates_select" ON broker_fee_rates
  FOR SELECT USING (get_my_household_id() IS NOT NULL);

CREATE POLICY "fee_rates_insert_admin" ON broker_fee_rates
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "fee_rates_update_admin" ON broker_fee_rates
  FOR UPDATE USING (is_admin());

-- Note: no DELETE policy — historical rates must be preserved

-- ============================================================
-- TRADES
-- All household members can view trades in their household
-- Only admin can insert/update/delete
-- ============================================================
CREATE POLICY "trades_select" ON trades
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY "trades_insert_admin" ON trades
  FOR INSERT WITH CHECK (household_id = get_my_household_id() AND is_admin());

CREATE POLICY "trades_update_admin" ON trades
  FOR UPDATE USING (household_id = get_my_household_id() AND is_admin());

CREATE POLICY "trades_delete_admin" ON trades
  FOR DELETE USING (household_id = get_my_household_id() AND is_admin());

-- ============================================================
-- TRADE_EXECUTIONS
-- Access controlled through trade's household membership
-- ============================================================
CREATE POLICY "executions_select" ON trade_executions
  FOR SELECT USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
  );

CREATE POLICY "executions_insert_admin" ON trade_executions
  FOR INSERT WITH CHECK (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

CREATE POLICY "executions_update_admin" ON trade_executions
  FOR UPDATE USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

CREATE POLICY "executions_delete_admin" ON trade_executions
  FOR DELETE USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

-- ============================================================
-- TRADE_CHARGE_BREAKDOWNS
-- ============================================================
CREATE POLICY "charge_breakdowns_select" ON trade_charge_breakdowns
  FOR SELECT USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
  );

CREATE POLICY "charge_breakdowns_insert_admin" ON trade_charge_breakdowns
  FOR INSERT WITH CHECK (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

CREATE POLICY "charge_breakdowns_update_admin" ON trade_charge_breakdowns
  FOR UPDATE USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

-- ============================================================
-- DEMAT_CHARGE_EVENTS
-- ============================================================
CREATE POLICY "demat_events_select" ON demat_charge_events
  FOR SELECT USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
  );

CREATE POLICY "demat_events_insert_admin" ON demat_charge_events
  FOR INSERT WITH CHECK (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

CREATE POLICY "demat_events_update_admin" ON demat_charge_events
  FOR UPDATE USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

-- ============================================================
-- ACTUAL_CHARGE_RECONCILIATIONS
-- ============================================================
CREATE POLICY "reconciliations_select" ON actual_charge_reconciliations
  FOR SELECT USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
  );

CREATE POLICY "reconciliations_insert_admin" ON actual_charge_reconciliations
  FOR INSERT WITH CHECK (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

CREATE POLICY "reconciliations_update_admin" ON actual_charge_reconciliations
  FOR UPDATE USING (
    trade_id IN (SELECT id FROM trades WHERE household_id = get_my_household_id())
    AND is_admin()
  );

-- ============================================================
-- CASH_MOVEMENTS
-- ============================================================
CREATE POLICY "cash_select" ON cash_movements
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY "cash_insert_admin" ON cash_movements
  FOR INSERT WITH CHECK (household_id = get_my_household_id() AND is_admin());

CREATE POLICY "cash_update_admin" ON cash_movements
  FOR UPDATE USING (household_id = get_my_household_id() AND is_admin());

CREATE POLICY "cash_delete_admin" ON cash_movements
  FOR DELETE USING (household_id = get_my_household_id() AND is_admin());

-- ============================================================
-- APP_SETTINGS
-- ============================================================
CREATE POLICY "settings_select" ON app_settings
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY "settings_update_admin" ON app_settings
  FOR UPDATE USING (household_id = get_my_household_id() AND is_admin());
