/**
 * TradeVault — Capital Management Types
 *
 * Domain types for the Capital & Profit Management module.
 * Strategy bucket mapping:
 *   INTRADAY = MIS (trade_type = 'INTRADAY')
 *   SWING    = CNC/DELIVERY (trade_type = 'DELIVERY')
 */

/** Explicit strategy bucket — alias for UI display and capital accounting. */
export type StrategyBucket = 'INTRADAY' | 'SWING';

/**
 * Maps trade_type from the trades table to the strategy bucket used for
 * capital accounting. This is the canonical, documented mapping.
 * DELIVERY trades are CNC (hold-overnight / swing) — they map to SWING.
 * Never silently default; unknown values should surface as an error.
 */
export function tradeTypeToStrategyBucket(
  tradeType: 'INTRADAY' | 'DELIVERY'
): StrategyBucket {
  switch (tradeType) {
    case 'INTRADAY':
      return 'INTRADAY';
    case 'DELIVERY':
      return 'SWING';
  }
}

/** Capital transaction types — append-only ledger. */
export type CapitalTxType =
  | 'INITIAL_ALLOCATION'    // First capital setup
  | 'CAPITAL_CONTRIBUTION'  // Additional capital added
  | 'CAPITAL_ADJUSTMENT'    // Admin correction with audit trail
  | 'CAPITAL_WITHDRAWAL'    // Withdrawal from contributed capital
  | 'PROFIT_WITHDRAWAL';    // Withdrawal from realized trading profits

/** A capital transaction record from the database. */
export interface CapitalTransaction {
  id: string;
  householdId: string;
  portfolioOwnerId: string;
  strategyBucket: StrategyBucket;
  txType: CapitalTxType;
  amount: number;
  txDate: string; // ISO date string
  createdBy: string;
  createdAt: string;
  notes: string | null;
  reversalOf: string | null;
  idempotencyKey: string | null;
  // Audit fields for CAPITAL_ADJUSTMENT
  previousAmount: number | null;
  newAmount: number | null;
  adjustmentDiff: number | null;
}

/**
 * Portfolio summary for a single owner + strategy bucket.
 * All formulas match the specification exactly.
 *
 * contributed_capital = SUM(INITIAL + CONTRIBUTION + ADJUSTMENT_DIFF) - SUM(CAPITAL_WITHDRAWAL)
 * available_profit = MAX(0, cumulative_net_realized_pnl - cumulative_profit_withdrawals)
 * current_capital = contributed_capital + cumulative_net_realized_pnl - cumulative_profit_withdrawals
 */
export interface StrategyCapitalSummary {
  portfolioOwnerId: string;
  strategyBucket: StrategyBucket;
  contributedCapital: number;
  cumulativeNetRealizedPnl: number;
  cumulativeProfitWithdrawals: number;
  cumulativeCapitalWithdrawals: number;
  availableProfitForWithdrawal: number;
  currentCapital: number;
  closedTradeCount: number;
}

/**
 * Combined summary for a single portfolio owner (Husband or Wife).
 * Totals Intraday + Swing buckets.
 */
export interface OwnerCapitalSummary {
  portfolioOwnerId: string;
  displayName: string;
  relationshipLabel: string;
  intraday: StrategyCapitalSummary;
  swing: StrategyCapitalSummary;
  // Totals (sum of intraday + swing)
  totalContributedCapital: number;
  totalCurrentCapital: number;
  totalNetRealizedPnl: number;
  totalAvailableProfitForWithdrawal: number;
  totalProfitWithdrawn: number;
  totalCapitalWithdrawn: number;
}

/** Household-level summary (both owners combined). */
export interface HouseholdCapitalSummary {
  householdId: string;
  owners: OwnerCapitalSummary[];
  // Combined household totals
  combinedContributedCapital: number;
  combinedCurrentCapital: number;
  combinedNetRealizedPnl: number;
  combinedAvailableProfit: number;
}

/** Payload for creating a new capital transaction (allocation, contribution, adjustment). */
export interface CreateCapitalTransactionInput {
  portfolioOwnerId: string;
  strategyBucket: StrategyBucket;
  txType: Exclude<CapitalTxType, 'CAPITAL_WITHDRAWAL' | 'PROFIT_WITHDRAWAL'>;
  amount: number;
  txDate: string;
  notes?: string;
  idempotencyKey?: string;
  // For CAPITAL_ADJUSTMENT
  previousAmount?: number;
  newAmount?: number;
}

/** Payload for recording a withdrawal. */
export interface RecordWithdrawalInput {
  portfolioOwnerId: string;
  strategyBucket: StrategyBucket;
  withdrawalType: 'PROFIT' | 'CAPITAL';
  amount: number;
  txDate: string;
  notes?: string;
  idempotencyKey?: string;
  /** For capital withdrawal: admin may override the safety check with explicit confirmation. */
  overrideCapitalLimit?: boolean;
  overrideReason?: string;
}

/** Response from the capital summary API. */
export interface CapitalSummaryResponse {
  summary: HouseholdCapitalSummary;
}

/** Response from the transactions API. */
export interface CapitalTransactionsResponse {
  transactions: CapitalTransaction[];
  total: number;
}

/** Validation result for a withdrawal attempt. */
export interface WithdrawalValidation {
  valid: boolean;
  availableAmount: number;
  requestedAmount: number;
  rejectionReason?: string;
  requiresOverrideConfirmation?: boolean;
}

/** For the reconciliation view. */
export interface ReconciliationEntry {
  label: string;
  amount: number;
  type: 'opening' | 'adjustment' | 'pnl' | 'withdrawal' | 'current';
  date?: string;
  notes?: string;
}

export interface ReconciliationView {
  portfolioOwnerId: string;
  strategyBucket: StrategyBucket;
  entries: ReconciliationEntry[];
  currentCapital: number;
}
