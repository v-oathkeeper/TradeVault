/**
 * TradeVault Fee Engine — Decimal Utilities
 * 
 * All financial arithmetic uses Decimal.js to avoid floating-point errors.
 * Never use raw JS arithmetic (+, *, /) for monetary values.
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 28,          // High internal precision
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 15,
});

export { Decimal };

/**
 * Convert a number or string to Decimal safely.
 * Throws if the value is NaN or infinite.
 */
export function toDecimal(value: number | string | Decimal): Decimal {
  const d = new Decimal(value);
  if (!d.isFinite()) {
    throw new Error(`Invalid financial value: ${value}`);
  }
  return d;
}

/**
 * Round to 2 decimal places (INR paise level) using ROUND_HALF_UP.
 */
export function roundToINR(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Round to 4 decimal places (intermediate calculation precision).
 */
export function roundTo4(value: Decimal): Decimal {
  return value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * Sum an array of Decimal values safely.
 */
export function sumDecimals(values: Decimal[]): Decimal {
  return values.reduce((acc, val) => acc.plus(val), new Decimal(0));
}

/**
 * Format a Decimal as INR currency string (e.g., ₹1,23,456.78)
 */
export function formatINR(value: Decimal | number | string): string {
  const d = toDecimal(value);
  const num = d.toNumber();
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Returns true if the Decimal value is positive (profit).
 */
export function isProfit(value: Decimal): boolean {
  return value.greaterThan(0);
}

/**
 * Returns true if the Decimal value is negative (loss).
 */
export function isLoss(value: Decimal): boolean {
  return value.lessThan(0);
}

/**
 * Safely multiply — used for turnover calculations.
 * turnover = price × quantity
 */
export function calcTurnover(price: Decimal, quantity: number): Decimal {
  return price.times(new Decimal(quantity));
}

/**
 * Apply a percentage rate to a base amount.
 * e.g., applyRate(turnover, 0.0003) for 0.03% brokerage
 */
export function applyRate(base: Decimal, rate: Decimal | number): Decimal {
  return base.times(toDecimal(rate));
}

/**
 * Apply a rate but cap at a maximum value.
 * Used for brokerage caps (e.g., Rs 20 per order for Zerodha).
 */
export function applyRateWithCap(
  base: Decimal,
  rate: Decimal | number,
  maxAmount: Decimal | number | null
): Decimal {
  const calculated = applyRate(base, rate);
  if (maxAmount === null) return calculated;
  const max = toDecimal(maxAmount);
  return Decimal.min(calculated, max);
}

/**
 * Convert a raw DB rate (stored as decimal fraction like 0.18 for 18%) 
 * to a Decimal for use in calculations.
 */
export function rateFromDB(rate: string | number): Decimal {
  return toDecimal(rate);
}
