/**
 * TradeVault — P&L Calculator
 * 
 * Core gross and net P&L calculations.
 * Handles LONG and SHORT directions, partial exits.
 * All calculations use Decimal.js for precision.
 */

import {
  Decimal,
  toDecimal,
  roundToINR,
  calcTurnover,
} from './decimal-utils';
import type {
  PnlInput,
  TradeDirection,
  UnrealizedPnlInput,
  UnrealizedPnlResult,
} from './types';

/**
 * Calculate gross P&L for a completed trade.
 * 
 * LONG:  gross = (exitPrice - entryPrice) × quantity
 * SHORT: gross = (entryPrice - exitPrice) × quantity
 */
export function calculateGrossPnl(input: PnlInput): Decimal {
  const entryPrice = toDecimal(input.entryPrice);
  const exitPrice = toDecimal(input.exitPrice);
  const qty = toDecimal(input.quantity);

  let gross: Decimal;

  if (input.direction === 'LONG') {
    gross = exitPrice.minus(entryPrice).times(qty);
  } else {
    // SHORT
    gross = entryPrice.minus(exitPrice).times(qty);
  }

  return roundToINR(gross);
}

/**
 * Calculate net P&L by deducting total charges from gross P&L.
 */
export function calculateNetPnl(grossPnl: Decimal, totalCharges: Decimal): Decimal {
  return roundToINR(grossPnl.minus(totalCharges));
}

/**
 * Calculate invested amount (value of the open position at entry).
 */
export function calculateInvestedAmount(entryPrice: number, quantity: number): Decimal {
  return roundToINR(calcTurnover(toDecimal(entryPrice), quantity));
}

/**
 * Estimate unrealized P&L for an open position using a manually provided current price.
 * This does NOT include actual broker charges — it uses the fee engine for an estimate.
 */
export function calculateUnrealizedPnl(input: UnrealizedPnlInput): UnrealizedPnlResult {
  const entryPrice = toDecimal(input.entryPrice);
  const currentPrice = toDecimal(input.currentPrice);
  const qty = input.quantity;

  // Unrealized gross P&L
  let unrealizedGross: Decimal;
  if (input.direction === 'LONG') {
    unrealizedGross = currentPrice.minus(entryPrice).times(qty);
  } else {
    unrealizedGross = entryPrice.minus(currentPrice).times(qty);
  }
  unrealizedGross = roundToINR(unrealizedGross);

  // Estimated exit charges (turnover-based estimate using sell turnover)
  const sellTurnover = calcTurnover(currentPrice, qty);
  const estimatedExitCharges = estimateExitCharges(
    sellTurnover,
    input.broker,
    input.tradeType
  );

  const unrealizedNet = roundToINR(unrealizedGross.minus(estimatedExitCharges));
  const investedAmount = roundToINR(calcTurnover(entryPrice, qty));

  return {
    unrealizedGrossPnl: unrealizedGross.toNumber(),
    estimatedExitCharges: estimatedExitCharges.toNumber(),
    unrealizedNetPnl: unrealizedNet.toNumber(),
    currentPrice: currentPrice.toNumber(),
    investedAmount: investedAmount.toNumber(),
  };
}

/**
 * Quick estimate of exit charges for open position display.
 * Uses approximate rates (not the full fee engine).
 * The full fee engine is used when actually closing a trade.
 */
function estimateExitCharges(
  sellTurnover: Decimal,
  broker: 'KITE' | 'SHOONYA',
  tradeType: 'INTRADAY' | 'DELIVERY'
): Decimal {
  // Approximate rates for estimation
  const sttRate = tradeType === 'INTRADAY' ? 0.00025 : 0.001;
  const exchangeTxnRate = 0.0000307; // NSE approximate
  const sebiRate = 0.000001;
  const brokerageRate = broker === 'KITE' ? 0.0003 : 0.0003;
  const brokerageCap = broker === 'KITE' ? 20 : 5;

  const stt = roundToINR(sellTurnover.times(toDecimal(sttRate)));
  const exchangeTxn = roundToINR(sellTurnover.times(toDecimal(exchangeTxnRate)));
  const sebi = roundToINR(sellTurnover.times(toDecimal(sebiRate)));
  const rawBrokerage = sellTurnover.times(toDecimal(brokerageRate));
  const brokerage = roundToINR(Decimal.min(rawBrokerage, new Decimal(brokerageCap)));
  const gst = roundToINR(brokerage.plus(exchangeTxn).plus(sebi).times(0.18));

  return stt.plus(exchangeTxn).plus(sebi).plus(brokerage).plus(gst);
}

/**
 * Calculate partial exit P&L.
 * For partial exits, only the closed quantity realizes P&L.
 * Remaining quantity stays open.
 */
export function calculatePartialExitPnl(
  direction: TradeDirection,
  entryPrice: number,
  exitPrice: number,
  closedQuantity: number
): Decimal {
  return calculateGrossPnl({
    direction,
    entryPrice,
    exitPrice,
    quantity: closedQuantity,
  });
}

/**
 * Portfolio equity curve data point calculation.
 * Capital additions/withdrawals are tracked separately and
 * NEVER counted as trading profits.
 */
export interface EquityPoint {
  date: string;
  cumulativeRealizedPnl: number;
  unrealizedPnl: number;
  capitalDeposited: number;
  capitalWithdrawn: number;
  portfolioValue: number; // cumulative realized + unrealized + net capital
}

/**
 * Validates that a quantity is a positive integer.
 */
export function validateQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity > 0;
}

/**
 * Validates that a price is a positive finite number.
 */
export function validatePrice(price: number): boolean {
  return isFinite(price) && price > 0;
}
