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
 */
export interface OwnerCapitalSummary {
  portfolioOwnerId: string;
  displayName: string;
  relationshipLabel: string;
  // Core Couple's Capital metrics:
  investedCapital: number;           // Initial Capital + Additional Capital - Capital Withdrawals
  availableProfit: number;           // Max(0, allTimeProfit - profitWithdrawn)
  allTimeProfit: number;             // Lifetime cumulative net realized P&L from closed trades
  initialCapital: number;            // Initial capital set by admin
  additionalCapital: number;         // Additional money added
  profitWithdrawn: number;           // Cumulative profit withdrawals
  capitalWithdrawn: number;          // Cumulative capital withdrawals
  // Strategy buckets (for detailed breakdown):
  intraday: StrategyCapitalSummary;
  swing: StrategyCapitalSummary;
  // Aliases for compatibility:
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
  // Primary Couple's Financial Metrics:
  combinedInvestedCapital: number;   // Husband Invested Capital + Wife Invested Capital
  combinedAvailableProfit: number;   // Husband Available Profit + Wife Available Profit
  combinedAllTimeProfit: number;     // Lifetime cumulative net realized P&L
  // Legacy / Compatibility aliases:
  combinedContributedCapital: number;
  combinedCurrentCapital: number;
  combinedNetRealizedPnl: number;
  combinedAvailableProfitForWithdrawal?: number;
}

/** Payload for creating a new capital transaction (allocation, contribution, adjustment). */
export interface CreateCapitalTransactionInput {
  portfolioOwnerId: string;
  strategyBucket?: StrategyBucket;
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
  strategyBucket?: StrategyBucket;
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
