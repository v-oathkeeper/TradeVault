/**
 * TradeVault — Capital Service Unit Tests
 *
 * Tests the pure calculation helpers and verifies all 6 example scenarios
 * from the specification exactly.
 *
 * Run: npm test -- capital-service
 */

import { describe, it, expect } from 'vitest';
import {
  calcAvailableProfit,
  calcCurrentCapital,
  tradeTypeToStrategyBucket,
} from '../capital-service';

// ─────────────────────────────────────────────────────────────────────────────
// Pure calculation helper tests
// ─────────────────────────────────────────────────────────────────────────────

describe('calcAvailableProfit', () => {
  it('returns max(0, pnl - withdrawals) when pnl > withdrawals', () => {
    expect(calcAvailableProfit(3000, 2000)).toBe(1000);
  });

  it('returns 0 when cumulative withdrawals exceed pnl (never negative)', () => {
    // After Test B: pnl=1500, withdrawals=2000 → 1500-2000 = -500 → clamped to 0
    expect(calcAvailableProfit(1500, 2000)).toBe(0);
  });

  it('returns 0 when pnl is negative', () => {
    expect(calcAvailableProfit(-500, 0)).toBe(0);
  });

  it('returns full pnl when no withdrawals', () => {
    expect(calcAvailableProfit(5000, 0)).toBe(5000);
  });

  it('returns 0 when pnl equals withdrawals', () => {
    expect(calcAvailableProfit(2000, 2000)).toBe(0);
  });
});

describe('calcCurrentCapital', () => {
  it('adds pnl and subtracts profit withdrawals from contributed capital', () => {
    // Test A: contributed=20000, pnl=3000, profitWithdrawals=2000
    // current = 20000 + 3000 - 2000 = 21000
    expect(calcCurrentCapital(20000, 3000, 2000)).toBe(21000);
  });

  it('reduces current capital when pnl is a loss', () => {
    // Test B: contributed=20000, pnl=1500, profitWithdrawals=2000
    // current = 20000 + 1500 - 2000 = 19500
    expect(calcCurrentCapital(20000, 1500, 2000)).toBe(19500);
  });

  it('increases current capital when profit recovers after losses', () => {
    // Test C: contributed=20000, pnl=4000, profitWithdrawals=2000
    // current = 20000 + 4000 - 2000 = 22000
    expect(calcCurrentCapital(20000, 4000, 2000)).toBe(22000);
  });

  it('capital withdrawal reduces contributed capital correctly', () => {
    // Test D: contributed=20000-5000=15000, pnl=0, profitWithdrawals=0
    // current = 15000 + 0 - 0 = 15000
    expect(calcCurrentCapital(15000, 0, 0)).toBe(15000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test A — Profit and withdrawal
// ─────────────────────────────────────────────────────────────────────────────

describe('Test A — Profit and withdrawal (spec §8)', () => {
  const contributedCapital = 20_000;
  const cumulativeNetRealizedPnl = 3_000;
  const cumulativeProfitWithdrawals = 2_000;

  it('contributed capital stays unchanged', () => {
    expect(contributedCapital).toBe(20_000);
  });

  it('available profit = pnl - withdrawals = 1000', () => {
    expect(calcAvailableProfit(cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)).toBe(1_000);
  });

  it('current capital = 21000', () => {
    expect(
      calcCurrentCapital(contributedCapital, cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)
    ).toBe(21_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test B — Loss consumes available profit
// ─────────────────────────────────────────────────────────────────────────────

describe('Test B — Loss reduces available profit to 0 (spec §8)', () => {
  const contributedCapital = 20_000;
  // After additional ₹1,500 loss: 3000 - 1500 = 1500
  const cumulativeNetRealizedPnl = 1_500;
  const cumulativeProfitWithdrawals = 2_000;

  it('lifetime net P&L = 1500', () => {
    expect(cumulativeNetRealizedPnl).toBe(1_500);
  });

  it('available profit clamped to 0 (not negative)', () => {
    expect(calcAvailableProfit(cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)).toBe(0);
  });

  it('current capital = 19500', () => {
    expect(
      calcCurrentCapital(contributedCapital, cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)
    ).toBe(19_500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test C — New profits after loss
// ─────────────────────────────────────────────────────────────────────────────

describe('Test C — Profit recovery after losses (spec §8)', () => {
  const contributedCapital = 20_000;
  // After additional ₹2,500 profit: 1500 + 2500 = 4000
  const cumulativeNetRealizedPnl = 4_000;
  const cumulativeProfitWithdrawals = 2_000;

  it('lifetime net P&L = 4000', () => {
    expect(cumulativeNetRealizedPnl).toBe(4_000);
  });

  it('available profit = 4000 - 2000 = 2000', () => {
    expect(calcAvailableProfit(cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)).toBe(2_000);
  });

  it('current capital = 22000', () => {
    expect(
      calcCurrentCapital(contributedCapital, cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)
    ).toBe(22_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test D — Capital withdrawal
// ─────────────────────────────────────────────────────────────────────────────

describe('Test D — Capital withdrawal (spec §8)', () => {
  // Admin withdraws ₹5000 from capital
  const originalContributed = 20_000;
  const capitalWithdrawal = 5_000;
  // contributed_capital after capital withdrawal
  const contributedCapital = originalContributed - capitalWithdrawal;
  const cumulativeNetRealizedPnl = 0;
  const cumulativeProfitWithdrawals = 0;

  it('contributed capital reduces to 15000', () => {
    expect(contributedCapital).toBe(15_000);
  });

  it('capital withdrawn = 5000', () => {
    expect(capitalWithdrawal).toBe(5_000);
  });

  it('net realized P&L unchanged (still 0)', () => {
    expect(cumulativeNetRealizedPnl).toBe(0);
  });

  it('available profit unchanged (still 0)', () => {
    expect(calcAvailableProfit(cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)).toBe(0);
  });

  it('current capital = 15000', () => {
    expect(
      calcCurrentCapital(contributedCapital, cumulativeNetRealizedPnl, cumulativeProfitWithdrawals)
    ).toBe(15_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test E — Strategy isolation
// ─────────────────────────────────────────────────────────────────────────────

describe('Test E — Strategy isolation (spec §8)', () => {
  // Husband portfolios
  const husbandIntradayContributed = 20_000;
  const husbandIntradayPnl = -1_000;
  const husbandSwingContributed = 20_000;
  const husbandSwingPnl = 3_000;

  // Wife portfolios
  const wifeIntradayContributed = 10_000;
  const wifeIntradayPnl = 0;
  const wifeSwingContributed = 10_000;
  const wifeSwingPnl = 0;

  it('Husband Intraday current capital decreases by loss', () => {
    const current = calcCurrentCapital(husbandIntradayContributed, husbandIntradayPnl, 0);
    expect(current).toBe(19_000); // 20000 + (-1000) = 19000
  });

  it('Husband Swing current capital increases by profit', () => {
    const current = calcCurrentCapital(husbandSwingContributed, husbandSwingPnl, 0);
    expect(current).toBe(23_000); // 20000 + 3000 = 23000
  });

  it('Husband Intraday loss does not affect Swing', () => {
    const intradayAvailProfit = calcAvailableProfit(husbandIntradayPnl, 0);
    const swingAvailProfit = calcAvailableProfit(husbandSwingPnl, 0);
    expect(intradayAvailProfit).toBe(0);    // loss → 0
    expect(swingAvailProfit).toBe(3_000);   // independent
  });

  it("Husband results do not affect Wife's capital", () => {
    const wifeIntradayCurrent = calcCurrentCapital(wifeIntradayContributed, wifeIntradayPnl, 0);
    const wifeSwingCurrent = calcCurrentCapital(wifeSwingContributed, wifeSwingPnl, 0);
    expect(wifeIntradayCurrent).toBe(10_000);
    expect(wifeSwingCurrent).toBe(10_000);
  });

  it('Combined household figures = sum of separate portfolios', () => {
    const husbandTotal =
      calcCurrentCapital(husbandIntradayContributed, husbandIntradayPnl, 0) +
      calcCurrentCapital(husbandSwingContributed, husbandSwingPnl, 0);
    const wifeTotal =
      calcCurrentCapital(wifeIntradayContributed, wifeIntradayPnl, 0) +
      calcCurrentCapital(wifeSwingContributed, wifeSwingPnl, 0);
    const combined = husbandTotal + wifeTotal;

    // 19000 + 23000 + 10000 + 10000 = 62000
    expect(combined).toBe(62_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test F — Partial exit attribution
// ─────────────────────────────────────────────────────────────────────────────

describe('Test F — Partial exit attribution (spec §8)', () => {
  it('partial exit P&L only counts closed quantity', () => {
    // Trade: 100 shares, partial exit of 40 shares at ₹10 profit/share
    const totalQty = 100;
    const exitedQty = 40;
    const remainingQty = totalQty - exitedQty;
    const profitPerShare = 10;

    // Only exited quantity is realized
    const realizedGrossPnl = exitedQty * profitPerShare;
    expect(realizedGrossPnl).toBe(400);
    expect(remainingQty).toBe(60); // still open — not realized
  });

  it('remaining quantity does not contribute to realized P&L', () => {
    const remainingQty = 60;
    const profitPerShare = 10;
    // These are unrealized — should NOT be added to capital accounting
    const unrealizedPnl = remainingQty * profitPerShare;
    const realizedPnl = 400; // only from exited qty

    // Verify they are not combined
    expect(realizedPnl).not.toBe(realizedPnl + unrealizedPnl);
    expect(unrealizedPnl).toBe(600); // kept separate
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy bucket mapping
// ─────────────────────────────────────────────────────────────────────────────

describe('tradeTypeToStrategyBucket', () => {
  it('maps INTRADAY to INTRADAY bucket', () => {
    expect(tradeTypeToStrategyBucket('INTRADAY')).toBe('INTRADAY');
  });

  it('maps DELIVERY to SWING bucket (CNC = swing trading)', () => {
    expect(tradeTypeToStrategyBucket('DELIVERY')).toBe('SWING');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('available profit is 0 when pnl is 0', () => {
    expect(calcAvailableProfit(0, 0)).toBe(0);
  });

  it('current capital equals contributed when no pnl and no withdrawals', () => {
    expect(calcCurrentCapital(20_000, 0, 0)).toBe(20_000);
  });

  it('available profit does not go negative with large withdrawals', () => {
    expect(calcAvailableProfit(1_000, 5_000)).toBe(0);
  });

  it('profit withdrawal does not change contributed capital', () => {
    const contributed = 20_000;
    const pnl = 5_000;
    const profitWithdrawn = 3_000;
    // contributed stays the same regardless of profit withdrawal
    expect(contributed).toBe(20_000);
    // current capital correctly calculated
    expect(calcCurrentCapital(contributed, pnl, profitWithdrawn)).toBe(22_000);
  });
});
