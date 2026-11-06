-- TradeVault: Trade Import Support Migration
-- Migration 005: Adds atomic batch import stored procedure and index for duplicate detection

-- ============================================================
-- INDEX: Optimize open trade duplicate detection
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_trades_dup_detection 
  ON trades (household_id, portfolio_owner_id, symbol, status)
  WHERE status = 'OPEN';

-- ============================================================
-- FUNCTION: import_trades_batch
-- Executes batch trade insertion atomically inside a single transaction.
-- If any record fails or constraint violates, the entire batch rolls back.
-- ============================================================
CREATE OR REPLACE FUNCTION import_trades_batch(
  p_household_id UUID,
  p_user_id UUID,
  p_trades JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_trade_id UUID;
  v_inserted_ids UUID[] := ARRAY[]::UUID[];
  v_count INT := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Verify caller is an active ADMIN of the household
  IF NOT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = p_household_id
      AND user_id = p_user_id
      AND role = 'ADMIN'
      AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Admin authorization required for household trade import';
  END IF;

  -- Iterate through each trade object in the jsonb array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_trades)
  LOOP
    -- Insert trade record
    INSERT INTO trades (
      household_id,
      portfolio_owner_id,
      broker_id,
      symbol,
      exchange,
      trade_type,
      direction,
      quantity,
      entry_price,
      entry_at,
      status,
      notes,
      initial_stop_loss,
      initial_risk_per_share,
      initial_risk_rupees,
      initial_risk_pct,
      planned_target,
      planned_rr,
      r1_price,
      r2_price,
      r3_price,
      strategy_name,
      current_stop_loss,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      p_household_id,
      (v_item->>'portfolio_owner_id')::UUID,
      (v_item->>'broker_id')::UUID,
      v_item->>'symbol',
      (v_item->>'exchange')::exchange_code,
      (v_item->>'trade_type')::trade_type,
      (v_item->>'direction')::trade_direction,
      (v_item->>'quantity')::INT,
      (v_item->>'entry_price')::NUMERIC,
      COALESCE((v_item->>'entry_at')::TIMESTAMPTZ, v_now),
      'OPEN',
      v_item->>'notes',
      (v_item->>'initial_stop_loss')::NUMERIC,
      (v_item->>'initial_risk_per_share')::NUMERIC,
      (v_item->>'initial_risk_rupees')::NUMERIC,
      (v_item->>'initial_risk_pct')::NUMERIC,
      (v_item->>'planned_target')::NUMERIC,
      (v_item->>'planned_rr')::NUMERIC,
      (v_item->>'r1_price')::NUMERIC,
      (v_item->>'r2_price')::NUMERIC,
      (v_item->>'r3_price')::NUMERIC,
      v_item->>'strategy_name',
      (v_item->>'initial_stop_loss')::NUMERIC,
      p_user_id,
      v_now,
      v_now
    )
    RETURNING id INTO v_trade_id;

    -- Insert initial stop-loss history entry
    INSERT INTO stop_loss_history (
      trade_id,
      previous_stop,
      new_stop,
      stop_type,
      notes,
      created_by,
      created_at
    ) VALUES (
      v_trade_id,
      NULL,
      (v_item->>'initial_stop_loss')::NUMERIC,
      'INITIAL',
      'Initial stop-loss set via JSON trade import',
      p_user_id,
      v_now
    );

    v_inserted_ids := array_append(v_inserted_ids, v_trade_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'imported_count', v_count,
    'trade_ids', to_jsonb(v_inserted_ids)
  );
END;
$$;
