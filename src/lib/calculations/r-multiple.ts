/**
 * TradeVault — R-Multiple Calculation Engine
 *
 * Pure functions with no side effects. All monetary inputs/outputs
 * are plain numbers; call site is responsible for Decimal.js precision
 * when writing to the database.
 *
 * Key concept: 1R = initial risk per share × quantity
 * - LONG:  initialStop must be BELOW entryPrice
 * - SHORT: initialStop must be ABOVE entryPrice
 */

export type TradeDirection = 'LONG' | 'SHORT';

// ============================================================
// TYPES
// ============================================================

export interface InitialRiskInput {
  entryPrice: number;
  initialStopLoss: number;
  quantity: number;
  direction: TradeDirection;
  plannedTarget?: number | null;
}

export interface InitialRiskResult {
  /** Price distance from entry to stop */
  riskPerShare: number;
  /** Total monetary risk: riskPerShare × quantity */
  riskRupees: number;
  /** Initial risk as % of entry price */
  riskPct: number;
  /** 1R target price (1× initial risk in profit direction) */
  r1Price: number;
  /** 2R target price */
  r2Price: number;
  /** 3R target price */
  r3Price: number;
  /** 4R target price */
  r4Price: number;
  /** Planned R:R ratio (null if no planned target) */
  plannedRR: number | null;
}

export interface RealizedRInput {
  netPnl: number;
  grossPnl: number;
  riskRupees: number;
}

export interface RealizedRResult {
  realizedR: number;
  grossR: number;
}

export type ROutcomeCategory =
  | 'big_winner'   // > 2R
  | 'winner'       // 1R to 2R
  | 'small_winner' // 0 to 1R
  | 'scratch'      // -0.25R to 0 (near-zero)
  | 'small_loss'   // -1R to -0.25R
  | 'full_loss'    // -1R (hit stop exactly)
  | 'big_loss';    // < -1R (blew through stop)

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Calculate all initial risk metrics from entry inputs.
 * Returns null if inputs are invalid (e.g., stop on wrong side).
 */
export function calculateInitialRisk(input: InitialRiskInput): InitialRiskResult | null {
  const { entryPrice, initialStopLoss, quantity, direction, plannedTarget } = input;

  if (entryPrice <= 0 || initialStopLoss <= 0 || quantity <= 0) return null;

  // Validate stop is on the correct side
  if (direction === 'LONG' && initialStopLoss >= entryPrice) return null;
  if (direction === 'SHORT' && initialStopLoss <= entryPrice) return null;

  const riskPerShare = Math.abs(entryPrice - initialStopLoss);
  const riskRupees = riskPerShare * quantity;
  const riskPct = (riskPerShare / entryPrice) * 100;

  // R-level target prices
  const dirMultiplier = direction === 'LONG' ? 1 : -1;
  const r1Price = entryPrice + dirMultiplier * riskPerShare * 1;
  const r2Price = entryPrice + dirMultiplier * riskPerShare * 2;
  const r3Price = entryPrice + dirMultiplier * riskPerShare * 3;
  const r4Price = entryPrice + dirMultiplier * riskPerShare * 4;

  // Planned R:R
  let plannedRR: number | null = null;
  if (plannedTarget != null && plannedTarget > 0 && riskPerShare > 0) {
    const rewardPerShare = Math.abs(plannedTarget - entryPrice);
    plannedRR = rewardPerShare / riskPerShare;
    // Validate target is on profit side
    if (direction === 'LONG' && plannedTarget <= entryPrice) plannedRR = null;
    if (direction === 'SHORT' && plannedTarget >= entryPrice) plannedRR = null;
  }

  return {
    riskPerShare: round4(riskPerShare),
    riskRupees: round4(riskRupees),
    riskPct: round6(riskPct),
    r1Price: round4(r1Price),
    r2Price: round4(r2Price),
    r3Price: round4(r3Price),
    r4Price: round4(r4Price),
    plannedRR: plannedRR != null ? round4(plannedRR) : null,
  };
}

/**
 * Compute realized R-multiples for a closed trade.
 * Returns null if riskRupees is 0 or missing.
 */
export function calculateRealizedR(input: RealizedRInput): RealizedRResult | null {
  const { netPnl, grossPnl, riskRupees } = input;
  if (!riskRupees || riskRupees === 0) return null;

  return {
    realizedR: round4(netPnl / riskRupees),
    grossR: round4(grossPnl / riskRupees),
  };
}

/**
 * Calculate current floating R-multiple for an open position.
 * Uses unrealized net P&L vs initial risk.
 */
export function calculateFloatingR(unrealizedNetPnl: number, riskRupees: number): number | null {
  if (!riskRupees || riskRupees === 0) return null;
  return round4(unrealizedNetPnl / riskRupees);
}

/**
 * Classify a realized R-multiple into a human-readable outcome category.
 */
export function classifyROutcome(r: number): ROutcomeCategory {
  if (r > 2) return 'big_winner';
  if (r >= 1) return 'winner';
  if (r >= 0) return 'small_winner';
  if (r >= -0.25) return 'scratch';
  if (r > -1) return 'small_loss';
  if (r >= -1.05) return 'full_loss';  // slight tolerance for charge drag
  return 'big_loss';
}

/**
 * Calculate system expectancy in R units:
 *   E = (winRate × avgWinR) − (lossRate × avgLossR)
 * A positive expectancy > 0 means the system is profitable in R-units per trade.
 */
export function calculateRExpectancy(
  winRate: number,           // 0–1
  avgWinR: number,           // positive
  avgLossR: number           // should be provided as absolute value (positive)
): number {
  const lossRate = 1 - winRate;
  return round4(winRate * avgWinR - lossRate * Math.abs(avgLossR));
}

/**
 * Validate that a stop-loss update is in the correct direction
 * (trailing stop should only move in profit direction).
 */
export function validateTrailingStopUpdate(
  direction: TradeDirection,
  currentStop: number,
  newStop: number,
  entryPrice: number
): { valid: boolean; message?: string } {
  if (newStop <= 0) {
    return { valid: false, message: 'Stop-loss must be positive' };
  }

  if (direction === 'LONG') {
    if (newStop >= entryPrice && newStop !== entryPrice) {
      // Allow setting to breakeven (entry), but trail must stay below entry initially
      // unless the trade is well in profit — we just warn, not block
    }
    if (newStop <= currentStop) {
      return { valid: false, message: 'Trailing stop for a LONG trade must be moved up, not down' };
    }
  } else {
    // SHORT: stop should move downward (toward profit)
    if (newStop >= currentStop) {
      return { valid: false, message: 'Trailing stop for a SHORT trade must be moved down, not up' };
    }
  }

  return { valid: true };
}

// ============================================================
// R-MULTIPLE DISTRIBUTION BUCKETS (for analytics histogram)
// ============================================================

export interface RBucket {
  label: string;
  min: number;
  max: number;
  color: string;
}

export const R_BUCKETS: RBucket[] = [
  { label: '< -2R',      min: -Infinity, max: -2,   color: '#dc2626' },
  { label: '-2R to -1R', min: -2,        max: -1,   color: '#ef4444' },
  { label: '-1R to 0R',  min: -1,        max: 0,    color: '#f97316' },
  { label: '0R to 1R',   min: 0,         max: 1,    color: '#84cc16' },
  { label: '1R to 2R',   min: 1,         max: 2,    color: '#22c55e' },
  { label: '> 2R',       min: 2,         max: Infinity, color: '#10b981' },
];

export function bucketRMultiples(rValues: number[]): { bucket: RBucket; count: number }[] {
  return R_BUCKETS.map((bucket) => ({
    bucket,
    count: rValues.filter(
      (r) => r > bucket.min && r <= bucket.max
    ).length,
  }));
}

// ============================================================
// HELPERS
// ============================================================

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round6(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}
