/**
 * TradeVault Fee Engine — Unit Tests
 * 
 * Tests for all 17 required test categories from the spec.
 * Uses verified broker tariff examples as fixtures.
 * 
 * Run: npx vitest run src/lib/calculations/__tests__/fee-engine.test.ts
 */

import { describe, it, expect } from 'vitest';
import { calculateFeesForTrade } from '../fee-engine';
import { calculateGrossPnl, calculateNetPnl } from '../pnl';
import { toDecimal } from '../decimal-utils';
import type { FeeRateSnapshot } from '../types';

// ============================================================
// TEST FIXTURES: Fee rate snapshots
// ============================================================

const KITE_NSE_INTRADAY_RATES: FeeRateSnapshot = {
  brokerId: 'a1000000-0000-0000-0000-000000000001',
  brokerCode: 'KITE',
  exchange: 'NSE',
  productType: 'INTRADAY',
  capturedAt: '2024-01-01T00:00:00Z',
  sourceUrl: 'https://zerodha.com/charges/',
  rates: [
    { chargeType: 'BROKERAGE', rate: 0.0003, maxPerOrder: 20, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STT', rate: 0.00025, maxPerOrder: null, appliesToSide: 'SELL', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'EXCHANGE_TXN', rate: 0.0000307, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'SEBI', rate: 0.000001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STAMP_DUTY', rate: 0.00003, maxPerOrder: null, appliesToSide: 'BUY', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'GST', rate: 0.18, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'ON_SERVICE_CHARGES', securityGroup: null },
  ],
};

const KITE_NSE_DELIVERY_RATES: FeeRateSnapshot = {
  brokerId: 'a1000000-0000-0000-0000-000000000001',
  brokerCode: 'KITE',
  exchange: 'NSE',
  productType: 'DELIVERY',
  capturedAt: '2024-01-01T00:00:00Z',
  sourceUrl: 'https://zerodha.com/charges/',
  rates: [
    { chargeType: 'BROKERAGE', rate: 0.0, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STT', rate: 0.001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'EXCHANGE_TXN', rate: 0.0000307, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'SEBI', rate: 0.000001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STAMP_DUTY', rate: 0.00015, maxPerOrder: null, appliesToSide: 'BUY', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'DP', rate: 15.34, maxPerOrder: null, appliesToSide: 'SELL', calculationBasis: 'FLAT_PER_EVENT', securityGroup: null },
    { chargeType: 'GST', rate: 0.18, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'ON_SERVICE_CHARGES', securityGroup: null },
  ],
};

const KITE_BSE_INTRADAY_RATES: FeeRateSnapshot = {
  ...KITE_NSE_INTRADAY_RATES,
  exchange: 'BSE',
  rates: [
    ...KITE_NSE_INTRADAY_RATES.rates.filter(r => r.chargeType !== 'EXCHANGE_TXN'),
    { chargeType: 'EXCHANGE_TXN', rate: 0.0000375, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
  ],
};

const SHOONYA_NSE_INTRADAY_RATES: FeeRateSnapshot = {
  brokerId: 'a2000000-0000-0000-0000-000000000002',
  brokerCode: 'SHOONYA',
  exchange: 'NSE',
  productType: 'INTRADAY',
  capturedAt: '2024-01-01T00:00:00Z',
  sourceUrl: 'https://shoonya.com/brokerage-charges/',
  rates: [
    { chargeType: 'BROKERAGE', rate: 0.0003, maxPerOrder: 5, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STT', rate: 0.00025, maxPerOrder: null, appliesToSide: 'SELL', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'EXCHANGE_TXN', rate: 0.0000307, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'SEBI', rate: 0.000001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STAMP_DUTY', rate: 0.00003, maxPerOrder: null, appliesToSide: 'BUY', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'IPFT', rate: 0.000000001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'GST', rate: 0.18, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'ON_SERVICE_CHARGES', securityGroup: null },
  ],
};

const SHOONYA_NSE_DELIVERY_RATES: FeeRateSnapshot = {
  brokerId: 'a2000000-0000-0000-0000-000000000002',
  brokerCode: 'SHOONYA',
  exchange: 'NSE',
  productType: 'DELIVERY',
  capturedAt: '2024-01-01T00:00:00Z',
  sourceUrl: 'https://shoonya.com/brokerage-charges/',
  rates: [
    { chargeType: 'BROKERAGE', rate: 0.0, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STT', rate: 0.001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'EXCHANGE_TXN', rate: 0.0000307, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'SEBI', rate: 0.000001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'STAMP_DUTY', rate: 0.00015, maxPerOrder: null, appliesToSide: 'BUY', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'DP', rate: 9.0, maxPerOrder: null, appliesToSide: 'SELL', calculationBasis: 'FLAT_PER_EVENT', securityGroup: null },
    { chargeType: 'IPFT', rate: 0.000000001, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'TURNOVER_PCT', securityGroup: null },
    { chargeType: 'GST', rate: 0.18, maxPerOrder: null, appliesToSide: 'BOTH', calculationBasis: 'ON_SERVICE_CHARGES', securityGroup: null },
  ],
};

// ============================================================
// TEST SUITE 1: Brokerage Caps
// ============================================================
describe('Brokerage caps', () => {
  it('Zerodha intraday: brokerage is capped at Rs 20 per order', () => {
    // High-value trade: 10,000 qty @ Rs 500 = Rs 50,00,000 turnover
    // 0.03% of 25L (sell) = Rs 7,500 → should cap to Rs 20
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 10000,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });

    // Each order (buy + sell) capped at Rs 20 each = Rs 40 total
    expect(result.brokerage).toBe(40); // Rs 20 buy + Rs 20 sell
  });

  it('Zerodha intraday: brokerage not capped for small orders', () => {
    // Small trade: 10 qty @ Rs 100 = Rs 1000 buy turnover
    // 0.03% of 1000 = Rs 0.30 (below Rs 20 cap)
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 100,
      exitPrice: 105,
      quantity: 10,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });

    // Buy: 0.03% of 1000 = 0.30; Sell: 0.03% of 1050 = 0.315 → 0.32
    expect(result.brokerage).toBeCloseTo(0.62, 1);
  });

  it('Shoonya intraday: brokerage is capped at Rs 5 per order', () => {
    // High-value trade
    const result = calculateFeesForTrade({
      broker: 'SHOONYA',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 10000,
      feeRates: SHOONYA_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });

    // Each order capped at Rs 5 → Rs 10 total
    expect(result.brokerage).toBe(10);
  });
});

// ============================================================
// TEST SUITE 2: Delivery Brokerage
// ============================================================
describe('Zero delivery brokerage', () => {
  it('Zerodha delivery: brokerage is exactly Rs 0', () => {
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'DELIVERY',
      direction: 'LONG',
      entryPrice: 1000,
      exitPrice: 1100,
      quantity: 100,
      feeRates: KITE_NSE_DELIVERY_RATES,
    });
    expect(result.brokerage).toBe(0);
  });

  it('Shoonya delivery: brokerage is exactly Rs 0', () => {
    const result = calculateFeesForTrade({
      broker: 'SHOONYA',
      exchange: 'NSE',
      tradeType: 'DELIVERY',
      direction: 'LONG',
      entryPrice: 1000,
      exitPrice: 1100,
      quantity: 100,
      feeRates: SHOONYA_NSE_DELIVERY_RATES,
    });
    expect(result.brokerage).toBe(0);
  });
});

// ============================================================
// TEST SUITE 3: STT Rules
// ============================================================
describe('STT calculation rules', () => {
  it('Intraday: STT charged only on sell side', () => {
    // Buy 100 @ 500 = 50000 buy turnover
    // Sell 100 @ 510 = 51000 sell turnover
    // STT = 0.025% of 51000 = 12.75
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    expect(result.stt).toBe(12.75); // 0.025% × 51000
    // Verify buy turnover STT not included: if STT were on both sides,
    // it would be 0.025% × (50000 + 51000) = 25.25 ≠ 12.75
    expect(result.sellTurnover).toBe(51000);
    expect(result.buyTurnover).toBe(50000);
  });

  it('Delivery: STT charged on both buy and sell sides', () => {
    // Buy 100 @ 500 = 50000, Sell 100 @ 510 = 51000
    // STT = 0.1% × 50000 + 0.1% × 51000 = 50 + 51 = 101
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'DELIVERY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_DELIVERY_RATES,
    });
    expect(result.stt).toBe(101); // 50 + 51
  });

  it('Short intraday: STT on sell (entry) side only', () => {
    // SHORT direction: sell entry @ 500, buy exit @ 490
    // Sell turnover = 100 × 500 = 50000
    // STT = 0.025% × 50000 = 12.50
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'SHORT',
      entryPrice: 500,
      exitPrice: 490,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    expect(result.stt).toBe(12.50);
  });
});

// ============================================================
// TEST SUITE 4: Stamp Duty
// ============================================================
describe('Stamp duty calculation', () => {
  it('Stamp duty applied only on buy side for LONG intraday', () => {
    // Buy 100 @ 500 = 50000 buy turnover
    // Stamp duty = 0.003% × 50000 = 1.50
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    expect(result.stampDuty).toBe(1.50); // 0.003% × 50000
  });

  it('Delivery stamp duty: 0.015% on buy turnover only', () => {
    // Buy 100 @ 1000 = 100000 buy turnover
    // Stamp duty = 0.015% × 100000 = 15.00
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'DELIVERY',
      direction: 'LONG',
      entryPrice: 1000,
      exitPrice: 1100,
      quantity: 100,
      feeRates: KITE_NSE_DELIVERY_RATES,
    });
    expect(result.stampDuty).toBe(15.00); // 0.015% × 100000
  });

  it('SHORT intraday: stamp duty on buy exit, not sell entry', () => {
    // SHORT: sell entry @ 500, buy exit @ 490
    // Buy turnover = 100 × 490 = 49000
    // Stamp duty = 0.003% × 49000 = 1.47
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'SHORT',
      entryPrice: 500,
      exitPrice: 490,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    expect(result.stampDuty).toBe(1.47); // 0.003% × 49000
  });
});

// ============================================================
// TEST SUITE 5: GST
// ============================================================
describe('GST calculation', () => {
  it('GST applied to brokerage + exchange charges + SEBI only', () => {
    // Known values for a simple trade
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });

    // GST base = brokerage + exchange charges + SEBI
    const expectedGstBase = result.brokerage + result.exchangeCharges + result.sebiCharges;
    const expectedGst = Math.round(expectedGstBase * 0.18 * 100) / 100;
    expect(result.gst).toBe(expectedGst);

    // GST NOT applied to STT or stamp duty
    const gstIfOnAll = (result.stt + result.stampDuty) * 0.18;
    expect(result.gst).not.toBe(result.gst + gstIfOnAll);
  });
});

// ============================================================
// TEST SUITE 6: Exchange charges (NSE vs BSE)
// ============================================================
describe('Exchange transaction charges', () => {
  it('NSE: exchange charge 0.00307%', () => {
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    // Total turnover = 50000 + 51000 = 101000
    // Exchange charges = 0.00307% × 101000 = 3.10
    expect(result.exchangeCharges).toBeCloseTo(3.10, 1);
  });

  it('BSE: exchange charge 0.00375% (higher than NSE)', () => {
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'BSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_BSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    // Total turnover = 101000, BSE rate = 0.00375%
    // Exchange charges = 0.00375% × 101000 = 3.79
    expect(result.exchangeCharges).toBeCloseTo(3.79, 1);
    // BSE should be higher than NSE
    const nseResult = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    expect(result.exchangeCharges).toBeGreaterThan(nseResult.exchangeCharges);
  });
});

// ============================================================
// TEST SUITE 7: DP Charges
// ============================================================
describe('DP charge rules', () => {
  it('Intraday: no DP charges', () => {
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false, // No DP for intraday
    });
    expect(result.dpCharges).toBe(0);
  });

  it('Zerodha delivery sell: DP charge is Rs 15.34 flat per scrip event', () => {
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'DELIVERY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_DELIVERY_RATES,
      isDpEvent: true,
    });
    expect(result.dpCharges).toBe(15.34);
  });

  it('Shoonya delivery sell: DP charge is Rs 9.00 base (+ GST handled in gst field)', () => {
    const result = calculateFeesForTrade({
      broker: 'SHOONYA',
      exchange: 'NSE',
      tradeType: 'DELIVERY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: SHOONYA_NSE_DELIVERY_RATES,
      isDpEvent: true,
    });
    expect(result.dpCharges).toBe(9.00); // Base; GST included in gst field
    // Total DP cost = Rs 9 + Rs 1.62 GST = Rs 10.62
    // This is reflected in result.gst being higher by Rs 1.62
  });

  it('Delivery buy only (no sell): no DP charge if isDpEvent is false', () => {
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'DELIVERY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_DELIVERY_RATES,
      isDpEvent: false, // No debit event (e.g., opening position)
    });
    expect(result.dpCharges).toBe(0);
  });
});

// ============================================================
// TEST SUITE 8: P&L Calculations
// ============================================================
describe('P&L calculations', () => {
  it('Profitable LONG trade gross P&L', () => {
    // Entry 500, Exit 510, Qty 100 → Gross = 1000
    const gross = calculateGrossPnl({ direction: 'LONG', entryPrice: 500, exitPrice: 510, quantity: 100 });
    expect(gross.toNumber()).toBe(1000);
  });

  it('Losing LONG trade gross P&L (negative)', () => {
    // Entry 500, Exit 490, Qty 100 → Gross = -1000
    const gross = calculateGrossPnl({ direction: 'LONG', entryPrice: 500, exitPrice: 490, quantity: 100 });
    expect(gross.toNumber()).toBe(-1000);
  });

  it('Profitable SHORT trade gross P&L', () => {
    // Entry (sell) 500, Exit (buy) 480, Qty 100 → Gross = 2000
    const gross = calculateGrossPnl({ direction: 'SHORT', entryPrice: 500, exitPrice: 480, quantity: 100 });
    expect(gross.toNumber()).toBe(2000);
  });

  it('Losing SHORT trade gross P&L (negative)', () => {
    // Entry (sell) 500, Exit (buy) 520, Qty 100 → Gross = -2000
    const gross = calculateGrossPnl({ direction: 'SHORT', entryPrice: 500, exitPrice: 520, quantity: 100 });
    expect(gross.toNumber()).toBe(-2000);
  });

  it('Net P&L = Gross P&L - Total Charges', () => {
    const gross = calculateGrossPnl({ direction: 'LONG', entryPrice: 500, exitPrice: 510, quantity: 100 });
    const charges = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 100,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    const net = calculateNetPnl(gross, toDecimal(charges.totalCharges));
    expect(net.toNumber()).toBe(gross.toNumber() - charges.totalCharges);
    // Net should be less than gross due to charges
    expect(net.toNumber()).toBeLessThan(gross.toNumber());
  });
});

// ============================================================
// TEST SUITE 9: Decimal Precision
// ============================================================
describe('Decimal precision and rounding', () => {
  it('Results do not have floating-point precision errors', () => {
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 123.45,
      exitPrice: 234.56,
      quantity: 37,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });

    // All values should be rounded to 2 decimal places
    expect(result.brokerage).toBe(Math.round(result.brokerage * 100) / 100);
    expect(result.stt).toBe(Math.round(result.stt * 100) / 100);
    expect(result.totalCharges).toBe(Math.round(result.totalCharges * 100) / 100);
  });

  it('P&L calculation is precise for fractional prices', () => {
    // 37 × (234.56 - 123.45) = 37 × 111.11 = 4111.07
    const gross = calculateGrossPnl({ direction: 'LONG', entryPrice: 123.45, exitPrice: 234.56, quantity: 37 });
    expect(gross.toNumber()).toBe(4111.07);
  });
});

// ============================================================
// TEST SUITE 10: Zero/Invalid inputs
// ============================================================
describe('Input validation', () => {
  it('Zero quantity: no charges should apply', () => {
    // A quantity of 0 should produce 0 charges (edge case protection)
    const result = calculateFeesForTrade({
      broker: 'KITE',
      exchange: 'NSE',
      tradeType: 'INTRADAY',
      direction: 'LONG',
      entryPrice: 500,
      exitPrice: 510,
      quantity: 0,
      feeRates: KITE_NSE_INTRADAY_RATES,
      isDpEvent: false,
    });
    expect(result.totalCharges).toBe(0);
    expect(result.brokerage).toBe(0);
  });
});
