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
import { measureAsync } from '@/lib/perf';
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
// Pure In-Memory Capital Summary Calculation
// ─────────────────────────────────────────────────────────────────────────────

export function calculateCapitalSummary(
  householdId: string,
  persons: { id: string; displayName: string; relationshipLabel: string }[],
  closedTrades: { portfolio_owner_id: string; trade_type: string; net_pnl: number | string | null }[],
  txRows?: CapitalTransactionRow[] | null
): HouseholdCapitalSummary {
  // Aggregate trade P&L in memory: key = `${ownerId}_${strategyBucket}`
  const pnlMap = new Map<string, { netPnl: number; count: number }>();
  for (const t of closedTrades) {
    if (t.net_pnl != null) {
      const bucket = tradeTypeToStrategyBucket(t.trade_type as 'INTRADAY' | 'DELIVERY');
      const key = `${t.portfolio_owner_id}_${bucket}`;
      const existing = pnlMap.get(key) ?? { netPnl: 0, count: 0 };
      existing.netPnl += Number(t.net_pnl);
      existing.count += 1;
      pnlMap.set(key, existing);
    }
  }

  // Aggregate Capital Transactions (ledger)
  interface LedgerTotals {
    contributedCapital: number;
    profitWithdrawals: number;
    capitalWithdrawals: number;
  }
  const ledgerMap = new Map<string, LedgerTotals>();

  if (txRows && txRows.length > 0) {
    // Collect reversed IDs so we exclude nullified transactions
    const reversedIds = new Set<string>();
    txRows.forEach((r) => {
      if (r.reversal_of) reversedIds.add(r.reversal_of);
    });

    for (const tx of txRows) {
      if (reversedIds.has(tx.id)) continue; // skip reversed source record

      const key = `${tx.portfolio_owner_id}_${tx.strategy_bucket}`;
      const current = ledgerMap.get(key) ?? {
        contributedCapital: 0,
        profitWithdrawals: 0,
        capitalWithdrawals: 0,
      };

      const amt = Number(tx.amount);
      switch (tx.tx_type) {
        case 'INITIAL_ALLOCATION':
        case 'CAPITAL_CONTRIBUTION':
          current.contributedCapital += amt;
          break;
        case 'CAPITAL_ADJUSTMENT':
          current.contributedCapital += Number(tx.adjustment_diff ?? 0);
          break;
        case 'CAPITAL_WITHDRAWAL':
          current.contributedCapital -= amt;
          current.capitalWithdrawals += amt;
          break;
        case 'PROFIT_WITHDRAWAL':
          current.profitWithdrawals += amt;
          break;
      }
      ledgerMap.set(key, current);
    }
  }

  // Build per-owner summaries
  const ownerSummaries: OwnerCapitalSummary[] = persons.map((person) => {
    const buildBucket = (bucket: StrategyBucket): StrategyCapitalSummary => {
      const key = `${person.id}_${bucket}`;
      const pnl = pnlMap.get(key) ?? { netPnl: 0, count: 0 };
      const ledger = ledgerMap.get(key) ?? {
        contributedCapital: 0,
        profitWithdrawals: 0,
        capitalWithdrawals: 0,
      };

      const availableProfit = Math.max(0, pnl.netPnl - ledger.profitWithdrawals);
      const currentCapital = ledger.contributedCapital + pnl.netPnl - ledger.profitWithdrawals;

      return {
        portfolioOwnerId: person.id,
        strategyBucket: bucket,
        contributedCapital: ledger.contributedCapital,
        cumulativeNetRealizedPnl: Math.round(pnl.netPnl * 100) / 100,
        cumulativeProfitWithdrawals: ledger.profitWithdrawals,
        cumulativeCapitalWithdrawals: ledger.capitalWithdrawals,
        availableProfitForWithdrawal: Math.round(availableProfit * 100) / 100,
        currentCapital: Math.round(currentCapital * 100) / 100,
        closedTradeCount: pnl.count,
      };
    };

    const intraday = buildBucket('INTRADAY');
    const swing = buildBucket('SWING');

    return {
      portfolioOwnerId: person.id,
      displayName: person.displayName,
      relationshipLabel: person.relationshipLabel,
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
// Fetch household capital summary (Fast, In-Memory Reconciled Calculation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches the complete capital accounting summary for a household.
 * Can reuse pre-fetched `persons` and `trades` from page components to eliminate
 * redundant network round trips, or queries them cleanly.
 *
 * If the PostgreSQL view `v_capital_summary` is not yet available, this automatically
 * and seamlessly derives exact figures from canonical `trades` and `capital_transactions`
 * without throwing errors or displaying missing schema warnings.
 */
export async function getHouseholdCapitalSummary(
  householdId: string,
  options?: {
    persons?: { id: string; displayName: string; relationshipLabel: string }[];
    closedTrades?: { portfolioOwnerId: string; tradeType: 'INTRADAY' | 'DELIVERY'; netPnl: number | null }[];
  }
): Promise<HouseholdCapitalSummary> {
  return measureAsync('getHouseholdCapitalSummary', async () => {
    const supabase = await createSupabaseServerClient();

    // 1. Resolve Persons
    let persons = options?.persons;
    if (!persons || persons.length === 0) {
      const { data: personsData, error: personsError } = await supabase
        .from('persons')
        .select('id, display_name, relationship_label')
        .eq('household_id', householdId)
        .eq('is_active', true);

      if (personsError) {
        throw new Error(`Failed to fetch persons: ${personsError.message}`);
      }

      persons = (personsData ?? []).map((p) => ({
        id: p.id,
        displayName: p.display_name,
        relationshipLabel: p.relationship_label,
      }));
    }

    // 2. Parallel fetch for trades & transactions if not provided
    type TradeItem = { portfolio_owner_id: string; trade_type: string; net_pnl: number | null };
    let closedTrades: TradeItem[] = [];
    let txRows: CapitalTransactionRow[] | null = null;

    if (options?.closedTrades) {
      closedTrades = options.closedTrades.map((t) => ({
        portfolio_owner_id: t.portfolioOwnerId,
        trade_type: t.tradeType,
        net_pnl: t.netPnl,
      }));

      const { data } = await supabase
        .from('capital_transactions')
        .select('*')
        .eq('household_id', householdId);
      txRows = (data as CapitalTransactionRow[]) ?? null;
    } else {
      const [tradesRes, txRes] = await Promise.all([
        supabase
          .from('trades')
          .select('portfolio_owner_id, trade_type, net_pnl')
          .eq('household_id', householdId)
          .eq('status', 'CLOSED'),
        supabase
          .from('capital_transactions')
          .select('*')
          .eq('household_id', householdId),
      ]);

      closedTrades = (tradesRes.data ?? []) as TradeItem[];
      txRows = (txRes.data as CapitalTransactionRow[]) ?? null;
    }

    return calculateCapitalSummary(householdId, persons, closedTrades, txRows);
  });
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
  return measureAsync('getCapitalTransactions', async () => {
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
      // Return empty list gracefully if table is not yet created
      if (error.code === 'PGRST205') {
        return { transactions: [], total: 0 };
      }
      throw new Error(`Failed to fetch capital transactions: ${error.message}`);
    }

    return {
      transactions: (data ?? []).map((r) => mapRow(r as CapitalTransactionRow)),
      total: count ?? 0,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate a withdrawal before recording it
// ─────────────────────────────────────────────────────────────────────────────

export async function validateWithdrawal(
  householdId: string,
  input: RecordWithdrawalInput
): Promise<WithdrawalValidation> {
  const summary = await getHouseholdCapitalSummary(householdId);
  const owner = summary.owners.find((o) => o.portfolioOwnerId === input.portfolioOwnerId);
  const strategyData =
    input.strategyBucket === 'INTRADAY' ? owner?.intraday : owner?.swing;

  if (input.withdrawalType === 'PROFIT') {
    const availableProfit = Number(strategyData?.availableProfitForWithdrawal ?? 0);
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
    const contributedCapital = Number(strategyData?.contributedCapital ?? 0);
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
