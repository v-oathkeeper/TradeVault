/**
 * TradeVault — Capital Service
 *
 * Server-side service for the Capital & Profit Management module.
 *
 * Key invariants:
 * - Realized net P&L is derived from trades.net_pnl (single source of truth).
 * - capital_transactions is append-only; corrections via reversal records.
 * - All math uses plain JS number arithmetic; monetary values are stored as NUMERIC(16,2).
 * - Strategy bucket mapping: INTRADAY → 'INTRADAY', DELIVERY → 'SWING'
 *
 * Formulas (per owner + strategy bucket):
 *   contributed_capital = Σ(INITIAL + CONTRIBUTION) + Σ(adjustment_diff) - Σ(CAPITAL_WITHDRAWAL)
 *   available_profit = max(0, net_realized_pnl - profit_withdrawals)
 *   current_capital = contributed_capital + net_realized_pnl - profit_withdrawals
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  StrategyBucket,
  CapitalTxType,
  CapitalTransaction,
  StrategyCapitalSummary,
  OwnerCapitalSummary,
  HouseholdCapitalSummary,
  CreateCapitalTransactionInput,
  RecordWithdrawalInput,
  WithdrawalValidation,
} from '@/types/capital';
import { tradeTypeToStrategyBucket } from '@/types/capital';
import type { CapitalTransactionRow } from '@/types/database';

// ─────────────────────────────────────────────────────────────────────────────
// Row mapper
// ─────────────────────────────────────────────────────────────────────────────

function mapRow(row: CapitalTransactionRow): CapitalTransaction {
  return {
    id: row.id,
    householdId: row.household_id,
    portfolioOwnerId: row.portfolio_owner_id,
    strategyBucket: row.strategy_bucket as StrategyBucket,
    txType: row.tx_type as CapitalTxType,
    amount: Number(row.amount),
    txDate: row.tx_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    notes: row.notes,
    reversalOf: row.reversal_of,
    idempotencyKey: row.idempotency_key,
    previousAmount: row.previous_amount != null ? Number(row.previous_amount) : null,
    newAmount: row.new_amount != null ? Number(row.new_amount) : null,
    adjustmentDiff: row.adjustment_diff != null ? Number(row.adjustment_diff) : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty strategy summary (for owners with no transactions yet)
// ─────────────────────────────────────────────────────────────────────────────

function emptyStrategySummary(
  portfolioOwnerId: string,
  strategyBucket: StrategyBucket
): StrategyCapitalSummary {
  return {
    portfolioOwnerId,
    strategyBucket,
    contributedCapital: 0,
    cumulativeNetRealizedPnl: 0,
    cumulativeProfitWithdrawals: 0,
    cumulativeCapitalWithdrawals: 0,
    availableProfitForWithdrawal: 0,
    currentCapital: 0,
    closedTradeCount: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch household capital summary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the complete capital accounting summary for a household.
 * Uses the v_capital_summary view for the aggregated math and
 * the persons table for display names.
 */
export async function getHouseholdCapitalSummary(
  householdId: string
): Promise<HouseholdCapitalSummary> {
  const supabase = await createSupabaseServerClient();

  // Fetch persons in this household
  const { data: personsData, error: personsError } = await supabase
    .from('persons')
    .select('id, display_name, relationship_label')
    .eq('household_id', householdId)
    .eq('is_active', true);

  if (personsError) {
    throw new Error(`Failed to fetch persons: ${personsError.message}`);
  }

  const persons = personsData ?? [];

  // Fetch capital summary from the view (server-side aggregation)
  // Note: v_capital_summary is a view, Supabase can query it like a table
  const { data: summaryRows, error: summaryError } = await supabase
    .from('v_capital_summary')
    .select('*')
    .eq('household_id', householdId);

  if (summaryError) {
    // View may not exist yet (before migration); return empty summary
    console.warn('v_capital_summary not available:', summaryError.message);
  }

  const rows = summaryRows ?? [];

  // Build per-owner summaries
  const ownerSummaries: OwnerCapitalSummary[] = persons.map((person) => {
    const intradayRow = rows.find(
      (r) => r.portfolio_owner_id === person.id && r.strategy_bucket === 'INTRADAY'
    );
    const swingRow = rows.find(
      (r) => r.portfolio_owner_id === person.id && r.strategy_bucket === 'SWING'
    );

    const intraday: StrategyCapitalSummary = intradayRow
      ? {
          portfolioOwnerId: person.id,
          strategyBucket: 'INTRADAY',
          contributedCapital: Number(intradayRow.contributed_capital ?? 0),
          cumulativeNetRealizedPnl: Number(intradayRow.cumulative_net_realized_pnl ?? 0),
          cumulativeProfitWithdrawals: Number(intradayRow.cumulative_profit_withdrawals ?? 0),
          cumulativeCapitalWithdrawals: Number(intradayRow.cumulative_capital_withdrawals ?? 0),
          availableProfitForWithdrawal: Number(intradayRow.available_profit_for_withdrawal ?? 0),
          currentCapital: Number(intradayRow.current_capital ?? 0),
          closedTradeCount: Number(intradayRow.closed_trade_count ?? 0),
        }
      : emptyStrategySummary(person.id, 'INTRADAY');

    const swing: StrategyCapitalSummary = swingRow
      ? {
          portfolioOwnerId: person.id,
          strategyBucket: 'SWING',
          contributedCapital: Number(swingRow.contributed_capital ?? 0),
          cumulativeNetRealizedPnl: Number(swingRow.cumulative_net_realized_pnl ?? 0),
          cumulativeProfitWithdrawals: Number(swingRow.cumulative_profit_withdrawals ?? 0),
          cumulativeCapitalWithdrawals: Number(swingRow.cumulative_capital_withdrawals ?? 0),
          availableProfitForWithdrawal: Number(swingRow.available_profit_for_withdrawal ?? 0),
          currentCapital: Number(swingRow.current_capital ?? 0),
          closedTradeCount: Number(swingRow.closed_trade_count ?? 0),
        }
      : emptyStrategySummary(person.id, 'SWING');

    return {
      portfolioOwnerId: person.id,
      displayName: person.display_name,
      relationshipLabel: person.relationship_label,
      intraday,
      swing,
      totalContributedCapital: intraday.contributedCapital + swing.contributedCapital,
      totalCurrentCapital: intraday.currentCapital + swing.currentCapital,
      totalNetRealizedPnl: intraday.cumulativeNetRealizedPnl + swing.cumulativeNetRealizedPnl,
      totalAvailableProfitForWithdrawal:
        intraday.availableProfitForWithdrawal + swing.availableProfitForWithdrawal,
      totalProfitWithdrawn:
        intraday.cumulativeProfitWithdrawals + swing.cumulativeProfitWithdrawals,
      totalCapitalWithdrawn:
        intraday.cumulativeCapitalWithdrawals + swing.cumulativeCapitalWithdrawals,
    };
  });

  const combinedContributedCapital = ownerSummaries.reduce(
    (sum, o) => sum + o.totalContributedCapital,
    0
  );
  const combinedCurrentCapital = ownerSummaries.reduce(
    (sum, o) => sum + o.totalCurrentCapital,
    0
  );
  const combinedNetRealizedPnl = ownerSummaries.reduce(
    (sum, o) => sum + o.totalNetRealizedPnl,
    0
  );
  const combinedAvailableProfit = ownerSummaries.reduce(
    (sum, o) => sum + o.totalAvailableProfitForWithdrawal,
    0
  );

  return {
    householdId,
    owners: ownerSummaries,
    combinedContributedCapital,
    combinedCurrentCapital,
    combinedNetRealizedPnl,
    combinedAvailableProfit,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch capital transactions (ledger history)
// ─────────────────────────────────────────────────────────────────────────────

export async function getCapitalTransactions(
  householdId: string,
  options?: {
    portfolioOwnerId?: string;
    strategyBucket?: StrategyBucket;
    limit?: number;
    offset?: number;
  }
): Promise<{ transactions: CapitalTransaction[]; total: number }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from('capital_transactions')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId)
    .order('tx_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.portfolioOwnerId) {
    query = query.eq('portfolio_owner_id', options.portfolioOwnerId);
  }
  if (options?.strategyBucket) {
    query = query.eq('strategy_bucket', options.strategyBucket);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, (options.offset + (options.limit ?? 50)) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch capital transactions: ${error.message}`);
  }

  return {
    transactions: (data ?? []).map((r) => mapRow(r as CapitalTransactionRow)),
    total: count ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate a withdrawal before recording it
// ─────────────────────────────────────────────────────────────────────────────

export async function validateWithdrawal(
  householdId: string,
  input: RecordWithdrawalInput
): Promise<WithdrawalValidation> {
  const supabase = await createSupabaseServerClient();

  // Get current summary for owner + strategy
  const { data: summaryRows } = await supabase
    .from('v_capital_summary')
    .select('*')
    .eq('household_id', householdId)
    .eq('portfolio_owner_id', input.portfolioOwnerId)
    .eq('strategy_bucket', input.strategyBucket)
    .maybeSingle();

  if (input.withdrawalType === 'PROFIT') {
    const availableProfit = Number(summaryRows?.available_profit_for_withdrawal ?? 0);
    if (input.amount > availableProfit) {
      return {
        valid: false,
        availableAmount: availableProfit,
        requestedAmount: input.amount,
        rejectionReason: `Withdrawal amount (₹${input.amount.toLocaleString('en-IN')}) exceeds available profit (₹${availableProfit.toLocaleString('en-IN')}).`,
      };
    }
    return {
      valid: true,
      availableAmount: availableProfit,
      requestedAmount: input.amount,
    };
  } else {
    // CAPITAL withdrawal
    const contributedCapital = Number(summaryRows?.contributed_capital ?? 0);
    if (input.amount > contributedCapital) {
      if (input.overrideCapitalLimit) {
        // Admin explicitly confirmed override
        return {
          valid: true,
          availableAmount: contributedCapital,
          requestedAmount: input.amount,
          requiresOverrideConfirmation: true,
        };
      }
      return {
        valid: false,
        availableAmount: contributedCapital,
        requestedAmount: input.amount,
        rejectionReason: `Withdrawal amount (₹${input.amount.toLocaleString('en-IN')}) exceeds contributed capital (₹${contributedCapital.toLocaleString('en-IN')}). Explicit admin confirmation required to override.`,
        requiresOverrideConfirmation: true,
      };
    }
    return {
      valid: true,
      availableAmount: contributedCapital,
      requestedAmount: input.amount,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create capital transaction (allocation / contribution / adjustment)
// ─────────────────────────────────────────────────────────────────────────────

export async function createCapitalTransaction(
  householdId: string,
  userId: string,
  input: CreateCapitalTransactionInput
): Promise<CapitalTransaction> {
  const supabase = await createSupabaseServerClient();

  // For CAPITAL_ADJUSTMENT, compute the signed diff
  let adjustmentDiff: number | null = null;
  if (input.txType === 'CAPITAL_ADJUSTMENT' && input.previousAmount != null && input.newAmount != null) {
    adjustmentDiff = input.newAmount - input.previousAmount;
  }

  const { data, error } = await supabase
    .from('capital_transactions')
    .insert({
      household_id: householdId,
      portfolio_owner_id: input.portfolioOwnerId,
      strategy_bucket: input.strategyBucket,
      tx_type: input.txType,
      amount: input.amount,
      tx_date: input.txDate,
      created_by: userId,
      notes: input.notes ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      previous_amount: input.previousAmount ?? null,
      new_amount: input.newAmount ?? null,
      adjustment_diff: adjustmentDiff,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This transaction has already been recorded (duplicate submission).');
    }
    throw new Error(`Failed to create capital transaction: ${error.message}`);
  }

  return mapRow(data as CapitalTransactionRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Record withdrawal (profit or capital)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordWithdrawal(
  householdId: string,
  userId: string,
  input: RecordWithdrawalInput
): Promise<CapitalTransaction> {
  const supabase = await createSupabaseServerClient();

  // Validate before inserting
  const validation = await validateWithdrawal(householdId, input);
  if (!validation.valid) {
    throw new Error(validation.rejectionReason ?? 'Withdrawal validation failed.');
  }

  const txType: CapitalTxType =
    input.withdrawalType === 'PROFIT' ? 'PROFIT_WITHDRAWAL' : 'CAPITAL_WITHDRAWAL';

  const { data, error } = await supabase
    .from('capital_transactions')
    .insert({
      household_id: householdId,
      portfolio_owner_id: input.portfolioOwnerId,
      strategy_bucket: input.strategyBucket,
      tx_type: txType,
      amount: input.amount,
      tx_date: input.txDate,
      created_by: userId,
      notes: input.notes ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('This withdrawal has already been recorded (duplicate submission).');
    }
    throw new Error(`Failed to record withdrawal: ${error.message}`);
  }

  return mapRow(data as CapitalTransactionRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse a transaction (correction; never deletes original)
// ─────────────────────────────────────────────────────────────────────────────

export async function reverseCapitalTransaction(
  householdId: string,
  userId: string,
  originalTransactionId: string,
  reason: string
): Promise<CapitalTransaction> {
  const supabase = await createSupabaseServerClient();

  // Fetch original transaction
  const { data: original, error: fetchError } = await supabase
    .from('capital_transactions')
    .select('*')
    .eq('id', originalTransactionId)
    .eq('household_id', householdId)
    .single();

  if (fetchError || !original) {
    throw new Error('Original transaction not found or access denied.');
  }

  // Check if already reversed
  const { data: existing } = await supabase
    .from('capital_transactions')
    .select('id')
    .eq('reversal_of', originalTransactionId)
    .maybeSingle();

  if (existing) {
    throw new Error('This transaction has already been reversed.');
  }

  const orig = original as CapitalTransactionRow;

  // Insert reversal record (same amount, negates the effect via reversed tx_type logic)
  const { data, error } = await supabase
    .from('capital_transactions')
    .insert({
      household_id: householdId,
      portfolio_owner_id: orig.portfolio_owner_id,
      strategy_bucket: orig.strategy_bucket,
      tx_type: orig.tx_type,
      amount: orig.amount,
      tx_date: new Date().toISOString().split('T')[0],
      created_by: userId,
      notes: `REVERSAL: ${reason}`,
      reversal_of: originalTransactionId,
      // For adjustments, negate the diff
      previous_amount: orig.new_amount,
      new_amount: orig.previous_amount,
      adjustment_diff: orig.adjustment_diff != null ? -Number(orig.adjustment_diff) : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record reversal: ${error.message}`);
  }

  return mapRow(data as CapitalTransactionRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure calculation helpers (used in tests and validation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate available profit for withdrawal.
 * Specification: max(0, cumulative_net_realized_pnl - cumulative_profit_withdrawals)
 */
export function calcAvailableProfit(
  cumulativeNetRealizedPnl: number,
  cumulativeProfitWithdrawals: number
): number {
  return Math.max(0, cumulativeNetRealizedPnl - cumulativeProfitWithdrawals);
}

/**
 * Calculate current capital.
 * Specification: contributed_capital + cumulative_net_realized_pnl - cumulative_profit_withdrawals
 */
export function calcCurrentCapital(
  contributedCapital: number,
  cumulativeNetRealizedPnl: number,
  cumulativeProfitWithdrawals: number
): number {
  return contributedCapital + cumulativeNetRealizedPnl - cumulativeProfitWithdrawals;
}

/**
 * Maps trade_type string to strategy_bucket string for query filtering.
 * Re-exported for use in queries.
 */
export { tradeTypeToStrategyBucket };
