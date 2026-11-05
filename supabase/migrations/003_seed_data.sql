-- TradeVault: Seed Data
-- Migration 003: Initial brokers, fee rates, household, persons

-- ============================================================
-- NOTE: Run this AFTER creating the two Supabase auth users:
--   Husband (ADMIN): husband@example.com
--   Wife (VIEWER):   wife@example.com
--
-- Replace the UUIDs below with actual auth.users UUIDs.
-- You can find them in Supabase Dashboard → Authentication → Users
-- ============================================================

-- ============================================================
-- BROKERS
-- ============================================================
INSERT INTO brokers (id, code, name, website_url, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'KITE', 'Zerodha Kite', 'https://kite.zerodha.com', TRUE),
  ('a2000000-0000-0000-0000-000000000002', 'SHOONYA', 'Shoonya by Finvasia', 'https://shoonya.com', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- BROKER FEE RATES (Zerodha Kite)
-- Source: https://zerodha.com/charges/
-- Last verified: 2024-01-01 (update this when rates change)
-- ============================================================

-- KITE INTRADAY RATES
INSERT INTO broker_fee_rates (
  broker_id, exchange, product_type, charge_type,
  rate, max_per_order, applies_to_side, calculation_basis,
  effective_from, source_url, last_verified_at, notes
) VALUES
  -- Brokerage: 0.03% of turnover per order, max ₹20
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'INTRADAY', 'BROKERAGE',
   0.0003, 20.00, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Zerodha intraday: 0.03% or Rs 20 per executed order, whichever is lower'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'INTRADAY', 'BROKERAGE',
   0.0003, 20.00, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Zerodha intraday: 0.03% or Rs 20 per executed order, whichever is lower'),

  -- STT: 0.025% on sell side only for intraday
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'INTRADAY', 'STT',
   0.00025, NULL, 'SELL', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Intraday equity STT: 0.025% on sell turnover'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'INTRADAY', 'STT',
   0.00025, NULL, 'SELL', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Intraday equity STT: 0.025% on sell turnover'),

  -- Exchange transaction charge: NSE 0.00307%
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'INTRADAY', 'EXCHANGE_TXN',
   0.0000307, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'NSE transaction charge 0.00307%'),

  -- Exchange transaction charge: BSE default 0.00375%
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'INTRADAY', 'EXCHANGE_TXN',
   0.0000375, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'BSE default transaction charge 0.00375%. May vary by security group.'),

  -- SEBI charges: Rs 10 per crore of turnover
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'INTRADAY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'SEBI charges: Rs 10 per crore = 0.0001%'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'INTRADAY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'SEBI charges: Rs 10 per crore = 0.0001%'),

  -- Stamp duty: 0.003% on buy side only
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'INTRADAY', 'STAMP_DUTY',
   0.00003, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Intraday stamp duty: 0.003% on buy turnover'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'INTRADAY', 'STAMP_DUTY',
   0.00003, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Intraday stamp duty: 0.003% on buy turnover'),

  -- GST: 18% on brokerage + exchange charges + SEBI charges
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'INTRADAY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI. NOT on STT or stamp duty.'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'INTRADAY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI. NOT on STT or stamp duty.');

-- KITE DELIVERY RATES
INSERT INTO broker_fee_rates (
  broker_id, exchange, product_type, charge_type,
  rate, max_per_order, applies_to_side, calculation_basis,
  effective_from, source_url, last_verified_at, notes
) VALUES
  -- Delivery brokerage: ZERO
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'DELIVERY', 'BROKERAGE',
   0.0, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Zerodha delivery brokerage: Rs 0 (free equity delivery)'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'DELIVERY', 'BROKERAGE',
   0.0, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Zerodha delivery brokerage: Rs 0 (free equity delivery)'),

  -- STT: 0.1% on both buy and sell for delivery
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'DELIVERY', 'STT',
   0.001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Delivery STT: 0.1% on both buy and sell turnover'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'DELIVERY', 'STT',
   0.001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Delivery STT: 0.1% on both buy and sell turnover'),

  -- Exchange transaction charge: NSE
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'DELIVERY', 'EXCHANGE_TXN',
   0.0000307, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'NSE transaction charge 0.00307%'),

  -- Exchange transaction charge: BSE default
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'DELIVERY', 'EXCHANGE_TXN',
   0.0000375, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'BSE default transaction charge 0.00375%. May vary by security group.'),

  -- SEBI charges
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'DELIVERY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01', 'SEBI charges: Rs 10/crore'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'DELIVERY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01', 'SEBI charges: Rs 10/crore'),

  -- Stamp duty: 0.015% on buy side for delivery
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'DELIVERY', 'STAMP_DUTY',
   0.00015, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Delivery stamp duty: 0.015% on buy turnover'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'DELIVERY', 'STAMP_DUTY',
   0.00015, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Delivery stamp duty: 0.015% on buy turnover'),

  -- DP charge: Rs 15.34 per scrip debit event (CDSL)
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'DELIVERY', 'DP',
   15.34, NULL, 'SELL', 'FLAT_PER_EVENT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Zerodha DP charge: Rs 15.34 per scrip debit event. Charged on SELL of delivery holdings.'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'DELIVERY', 'DP',
   15.34, NULL, 'SELL', 'FLAT_PER_EVENT',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'Zerodha DP charge: Rs 15.34 per scrip debit event. Charged on SELL of delivery holdings.'),

  -- GST: 18%
  ('a1000000-0000-0000-0000-000000000001', 'NSE', 'DELIVERY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI. NOT on STT or stamp duty.'),
  ('a1000000-0000-0000-0000-000000000001', 'BSE', 'DELIVERY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://zerodha.com/charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI. NOT on STT or stamp duty.');

-- ============================================================
-- BROKER FEE RATES (Shoonya)
-- Source: https://shoonya.com/brokerage-charges/
-- Last verified: 2024-01-01
-- ============================================================

-- SHOONYA INTRADAY RATES
INSERT INTO broker_fee_rates (
  broker_id, exchange, product_type, charge_type,
  rate, max_per_order, applies_to_side, calculation_basis,
  effective_from, source_url, last_verified_at, notes
) VALUES
  -- Brokerage: 0.03% of turnover per order, max ₹5 (Shoonya cap is Rs 5)
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'INTRADAY', 'BROKERAGE',
   0.0003, 5.00, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Shoonya intraday: 0.03% or Rs 5 per executed order, whichever is lower'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'INTRADAY', 'BROKERAGE',
   0.0003, 5.00, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Shoonya intraday: 0.03% or Rs 5 per executed order, whichever is lower'),

  -- STT: same as NSE standard
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'INTRADAY', 'STT',
   0.00025, NULL, 'SELL', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Intraday equity STT: 0.025% on sell turnover'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'INTRADAY', 'STT',
   0.00025, NULL, 'SELL', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Intraday equity STT: 0.025% on sell turnover'),

  -- NSE exchange transaction charge: 0.00307%
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'INTRADAY', 'EXCHANGE_TXN',
   0.0000307, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'NSE transaction charge 0.00307%'),

  -- BSE exchange transaction charge: Shoonya uses 0.00307% for BSE too (verify with Shoonya)
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'INTRADAY', 'EXCHANGE_TXN',
   0.0000307, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'BSE transaction charge for Shoonya - verify against contract note'),

  -- SEBI charges
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'INTRADAY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01', 'SEBI Rs 10/crore'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'INTRADAY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01', 'SEBI Rs 10/crore'),

  -- Stamp duty
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'INTRADAY', 'STAMP_DUTY',
   0.00003, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Intraday stamp duty: 0.003% on buy turnover'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'INTRADAY', 'STAMP_DUTY',
   0.00003, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Intraday stamp duty: 0.003% on buy turnover'),

  -- IPFT: Rs 0.01 per crore = 0.000000001 per rupee; enabled by default for Shoonya NSE
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'INTRADAY', 'IPFT',
   0.0000000010, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'IPFT: Rs 0.01 per crore of traded value. Enabled by default for Shoonya NSE intraday.'),

  -- GST: 18%
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'INTRADAY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI + IPFT (where applicable)'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'INTRADAY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI');

-- SHOONYA DELIVERY RATES
INSERT INTO broker_fee_rates (
  broker_id, exchange, product_type, charge_type,
  rate, max_per_order, applies_to_side, calculation_basis,
  effective_from, source_url, last_verified_at, notes
) VALUES
  -- Delivery brokerage: ZERO
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'BROKERAGE',
   0.0, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Shoonya delivery brokerage: Rs 0 (free equity delivery)'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'DELIVERY', 'BROKERAGE',
   0.0, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Shoonya delivery brokerage: Rs 0 (free equity delivery)'),

  -- STT: 0.1% on both sides
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'STT',
   0.001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Delivery STT: 0.1% on both buy and sell turnover'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'DELIVERY', 'STT',
   0.001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Delivery STT: 0.1% on both buy and sell turnover'),

  -- Exchange transaction charges
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'EXCHANGE_TXN',
   0.0000307, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'NSE transaction charge 0.00307%'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'DELIVERY', 'EXCHANGE_TXN',
   0.0000307, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'BSE transaction charge for Shoonya delivery - verify against contract note'),

  -- SEBI charges
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01', 'SEBI Rs 10/crore'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'DELIVERY', 'SEBI',
   0.000001, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01', 'SEBI Rs 10/crore'),

  -- Stamp duty: 0.015% on buy for delivery
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'STAMP_DUTY',
   0.00015, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Delivery stamp duty: 0.015% on buy turnover'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'DELIVERY', 'STAMP_DUTY',
   0.00015, NULL, 'BUY', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Delivery stamp duty: 0.015% on buy turnover'),

  -- DP charge: Rs 9 + GST per scrip debit (Shoonya CDSL)
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'DP',
   9.00, NULL, 'SELL', 'FLAT_PER_EVENT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Shoonya DP charge: Rs 9 per scrip debit event + GST 18% (= Rs 10.62 effective). Charged on SELL of delivery holdings.'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'DELIVERY', 'DP',
   9.00, NULL, 'SELL', 'FLAT_PER_EVENT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'Shoonya DP charge: Rs 9 per scrip debit event + GST 18% (= Rs 10.62 effective). Charged on SELL of delivery holdings.'),

  -- IPFT for delivery NSE
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'IPFT',
   0.0000000010, NULL, 'BOTH', 'TURNOVER_PCT',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'IPFT: Rs 0.01 per crore. Enabled by default for Shoonya NSE.'),

  -- GST: 18%
  ('a2000000-0000-0000-0000-000000000002', 'NSE', 'DELIVERY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI + DP + IPFT'),
  ('a2000000-0000-0000-0000-000000000002', 'BSE', 'DELIVERY', 'GST',
   0.18, NULL, 'BOTH', 'ON_SERVICE_CHARGES',
   '2023-01-01', 'https://shoonya.com/brokerage-charges/', '2024-01-01',
   'GST 18% on brokerage + exchange txn + SEBI + DP');

-- ============================================================
-- HOUSEHOLD, PERSONS, SETTINGS
-- Run AFTER creating auth users in Supabase dashboard
-- ============================================================

-- Step 1: Create household
INSERT INTO households (id, name) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Family Trading Portfolio')
ON CONFLICT (id) DO NOTHING;

-- Step 2: App settings for household
INSERT INTO app_settings (household_id, default_theme, currency, timezone) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'SYSTEM', 'INR', 'Asia/Kolkata')
ON CONFLICT (household_id) DO NOTHING;

-- Step 3: Create persons (portfolio owners)
INSERT INTO persons (id, household_id, display_name, relationship_label, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Husband', 'Husband', TRUE),
  ('c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Wife', 'Wife', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- IMPORTANT: Steps 4 and 5 require auth user UUIDs
-- Run these AFTER creating users in Supabase Auth:
--
--   1. Go to Supabase Dashboard → Authentication → Users
--   2. Create user: husband@example.com (ADMIN)
--   3. Create user: wife@example.com (VIEWER)
--   4. Copy their UUIDs and replace HUSBAND_UUID and WIFE_UUID below
-- ============================================================

-- Step 4: Create profiles (if trigger didn't run)
-- INSERT INTO profiles (id, full_name) VALUES
--   ('HUSBAND_UUID', 'Husband'),
--   ('WIFE_UUID', 'Meet');

-- Step 5: Add users to household
-- INSERT INTO household_members (household_id, user_id, role) VALUES
--   ('b1000000-0000-0000-0000-000000000001', 'HUSBAND_UUID', 'ADMIN'),
--   ('b1000000-0000-0000-0000-000000000001', 'WIFE_UUID', 'VIEWER');
