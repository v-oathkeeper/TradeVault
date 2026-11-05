-- TradeVault: Initial Schema Migration
-- Migration 001: Core tables, types, and RLS policies

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('ADMIN', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trade_type AS ENUM ('INTRADAY', 'DELIVERY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trade_direction AS ENUM ('LONG', 'SHORT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trade_status AS ENUM ('OPEN', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE execution_type AS ENUM ('ENTRY', 'EXIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE movement_type AS ENUM ('DEPOSIT', 'WITHDRAWAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE theme_preference AS ENUM ('LIGHT', 'DARK', 'SYSTEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE calculation_status AS ENUM ('ESTIMATED', 'RECONCILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE exchange_code AS ENUM ('NSE', 'BSE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: households
-- ============================================================
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: profiles
-- Mirrors auth.users; one row per Supabase auth user
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: household_members
-- Links auth users to households with a role
-- ============================================================
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'VIEWER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- ============================================================
-- TABLE: persons
-- Portfolio owners; independent of login accounts
-- ============================================================
CREATE TABLE persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  relationship_label TEXT NOT NULL, -- 'Husband', 'Wife', etc.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: brokers
-- ============================================================
CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,  -- 'KITE', 'SHOONYA'
  name TEXT NOT NULL,
  website_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: broker_fee_rates
-- Effective-dated, per-charge-type fee configuration rows.
-- Each row represents a single configurable rate for a specific
-- broker, exchange, product, charge_type combination.
-- Never delete; always create new rows for rate changes.
-- ============================================================
CREATE TABLE broker_fee_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE RESTRICT,
  exchange exchange_code,             -- NULL means applies to all exchanges
  product_type trade_type NOT NULL,
  charge_type TEXT NOT NULL,          -- 'BROKERAGE', 'STT', 'EXCHANGE_TXN', 'SEBI', 'STAMP_DUTY', 'GST', 'DP', 'IPFT', etc.
  rate NUMERIC(18, 10) NOT NULL,      -- decimal fraction (e.g., 0.0003 for 0.03%)
  max_per_order NUMERIC(16, 4),       -- brokerage cap per order (null if none)
  applies_to_side TEXT NOT NULL,      -- 'BUY', 'SELL', 'BOTH'
  calculation_basis TEXT NOT NULL,    -- 'TURNOVER_PCT', 'FLAT_PER_EVENT', 'FLAT_PER_CRORE'
  security_group TEXT,                -- For BSE security group overrides (NULL = default)
  effective_from DATE NOT NULL,
  effective_to DATE,                  -- NULL means currently active
  source_url TEXT,
  last_verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Prevent overlapping effective dates per rate type
-- Uses NULLS NOT DISTINCT (supported in PostgreSQL 15+, standard in Supabase)
CREATE UNIQUE INDEX idx_fee_rates_no_overlap ON broker_fee_rates (
  broker_id, product_type, charge_type, exchange, security_group
) NULLS NOT DISTINCT WHERE effective_to IS NULL;

-- ============================================================
-- TABLE: trades
-- Core trade record
-- ============================================================
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
  portfolio_owner_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE RESTRICT,
  symbol TEXT NOT NULL,
  exchange exchange_code NOT NULL DEFAULT 'NSE',
  trade_type trade_type NOT NULL,
  direction trade_direction NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  entry_price NUMERIC(14, 4) NOT NULL CHECK (entry_price > 0),
  exit_price NUMERIC(14, 4) CHECK (exit_price > 0),
  entry_at TIMESTAMPTZ NOT NULL,
  exit_at TIMESTAMPTZ,
  gross_pnl NUMERIC(16, 4),
  total_charges NUMERIC(16, 4) NOT NULL DEFAULT 0,
  net_pnl NUMERIC(16, 4),
  charges_breakdown JSONB,            -- Full itemized snapshot
  calculation_status calculation_status NOT NULL DEFAULT 'ESTIMATED',
  status trade_status NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Business rules
  CONSTRAINT chk_closed_trade_has_exit
    CHECK (status = 'OPEN' OR (exit_price IS NOT NULL AND exit_at IS NOT NULL)),
  CONSTRAINT chk_open_trade_no_exit
    CHECK (status = 'CLOSED' OR (exit_price IS NULL AND exit_at IS NULL))
);

-- Indexes for common query patterns
CREATE INDEX idx_trades_household ON trades(household_id);
CREATE INDEX idx_trades_owner ON trades(portfolio_owner_id);
CREATE INDEX idx_trades_broker ON trades(broker_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_entry_at ON trades(entry_at);
CREATE INDEX idx_trades_exit_at ON trades(exit_at);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_type ON trades(trade_type);

-- ============================================================
-- TABLE: trade_executions
-- Supports multiple fills and partial exits
-- ============================================================
CREATE TABLE trade_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  execution_type execution_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(14, 4) NOT NULL CHECK (price > 0),
  executed_at TIMESTAMPTZ NOT NULL,
  broker_order_id TEXT,              -- For grouping fills, dedup brokerage cap
  charges JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executions_trade ON trade_executions(trade_id);

-- ============================================================
-- TABLE: trade_charge_breakdowns
-- Persisted charge snapshot per trade (one row per trade)
-- ============================================================
CREATE TABLE trade_charge_breakdowns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL UNIQUE REFERENCES trades(id) ON DELETE CASCADE,
  brokerage NUMERIC(16, 4) NOT NULL DEFAULT 0,
  stt NUMERIC(16, 4) NOT NULL DEFAULT 0,
  exchange_charges NUMERIC(16, 4) NOT NULL DEFAULT 0,
  sebi_charges NUMERIC(16, 4) NOT NULL DEFAULT 0,
  gst NUMERIC(16, 4) NOT NULL DEFAULT 0,
  stamp_duty NUMERIC(16, 4) NOT NULL DEFAULT 0,
  ipft NUMERIC(16, 4) NOT NULL DEFAULT 0,
  dp_charges NUMERIC(16, 4) NOT NULL DEFAULT 0,
  other_charges NUMERIC(16, 4) NOT NULL DEFAULT 0,
  total_charges NUMERIC(16, 4) NOT NULL DEFAULT 0,
  gross_pnl NUMERIC(16, 4),
  net_pnl NUMERIC(16, 4),
  fee_rates_snapshot JSONB,          -- Rates used at calculation time
  calculation_status calculation_status NOT NULL DEFAULT 'ESTIMATED',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: demat_charge_events
-- Tracks DP debit events independently for accurate charging
-- ============================================================
CREATE TABLE demat_charge_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  portfolio_owner_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE RESTRICT,
  symbol TEXT NOT NULL,
  event_date DATE NOT NULL,
  estimated_dp_charge NUMERIC(16, 4) NOT NULL DEFAULT 0,
  actual_dp_charge NUMERIC(16, 4),
  is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: actual_charge_reconciliations
-- Admin enters actual contract-note charges
-- ============================================================
CREATE TABLE actual_charge_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL UNIQUE REFERENCES trades(id) ON DELETE CASCADE,
  contract_note_ref TEXT,
  actual_brokerage NUMERIC(16, 4),
  actual_stt NUMERIC(16, 4),
  actual_exchange_charges NUMERIC(16, 4),
  actual_sebi_charges NUMERIC(16, 4),
  actual_gst NUMERIC(16, 4),
  actual_stamp_duty NUMERIC(16, 4),
  actual_dp_charges NUMERIC(16, 4),
  actual_total_charges NUMERIC(16, 4),
  actual_net_pnl NUMERIC(16, 4),
  reconciled_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- ============================================================
-- TABLE: cash_movements
-- Deposits and withdrawals — NEVER counted as trading profit
-- ============================================================
CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  portfolio_owner_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  movement_type movement_type NOT NULL,
  amount NUMERIC(16, 4) NOT NULL CHECK (amount > 0),
  movement_date DATE NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_movements_household ON cash_movements(household_id);
CREATE INDEX idx_cash_movements_owner ON cash_movements(portfolio_owner_id);

-- ============================================================
-- TABLE: app_settings
-- Per-household application settings
-- ============================================================
CREATE TABLE app_settings (
  household_id UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  default_theme theme_preference NOT NULL DEFAULT 'SYSTEM',
  currency TEXT NOT NULL DEFAULT 'INR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_households
  BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_trades
  BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_app_settings
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Ensure user creation in auth.users never fails even if profile creation hits an error
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
