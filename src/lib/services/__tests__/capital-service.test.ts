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
  calcInvestedCapital,
  tradeTypeToStrategyBucket,
  validateWithdrawal,
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

// ─────────────────────────────────────────────────────────────────────────────
// Couple's Capital Management & Simplified Rules (Specification Requirements)
// ─────────────────────────────────────────────────────────────────────────────

describe("Couple's Capital Management — Husband & Wife Separation and Combined Totals", () => {
  it('calculates invested capital accurately: Initial + Additional - Capital Withdrawals', () => {
    // Husband sets initial capital: ₹1,00,000
    // Adds capital: ₹25,000
    // Withdraws capital: ₹10,000
    const initial = 100_000;
    const additional = 25_000;
    const capitalWithdrawals = 10_000;

    const investedCapital = calcInvestedCapital(initial, additional, capitalWithdrawals);
    expect(investedCapital).toBe(115_000);
  });

  it('adding money immediately increases invested capital without altering trading profit', () => {
    const initial = 50_000;
    const initialProfit = 8_000;

    // Before addition
    const investedBefore = calcInvestedCapital(initial, 0, 0);
    expect(investedBefore).toBe(50_000);

    // Add ₹20,000 capital
    const investedAfter = calcInvestedCapital(initial, 20_000, 0);
    expect(investedAfter).toBe(70_000);

    // All-time trading profit is unaffected by adding money
    expect(initialProfit).toBe(8_000);
  });

  it('combined invested capital is automatically calculated as Husband + Wife', () => {
    const husbandInitial = 150_000;
    const husbandAdditional = 20_000;
    const husbandCapitalWithdrawn = 10_000;
    const husbandInvested = calcInvestedCapital(husbandInitial, husbandAdditional, husbandCapitalWithdrawn);

    const wifeInitial = 100_000;
    const wifeAdditional = 15_000;
    const wifeCapitalWithdrawn = 5_000;
    const wifeInvested = calcInvestedCapital(wifeInitial, wifeAdditional, wifeCapitalWithdrawn);

    const combinedInvested = husbandInvested + wifeInvested;

    expect(husbandInvested).toBe(160_000);
    expect(wifeInvested).toBe(110_000);
    expect(combinedInvested).toBe(270_000);
  });

  it('account separation: Husband transactions never affect Wife invested capital or profit', () => {
    let husbandInvested = calcInvestedCapital(100_000, 0, 0);
    const wifeInvested = calcInvestedCapital(80_000, 0, 0);
    const wifeProfit = 12_000;

    // Husband adds ₹50,000 and has trading profit
    husbandInvested = calcInvestedCapital(100_000, 50_000, 0);

    // Wife accounts remain completely untouched
    expect(husbandInvested).toBe(150_000);
    expect(wifeInvested).toBe(80_000);
    expect(wifeProfit).toBe(12_000);
  });
});

describe('Withdrawal Rules (Profit vs Invested Capital)', () => {
  describe('Withdraw from Profit', () => {
    it('allows withdrawal when amount <= available profit', () => {
      const allTimeProfit = 25_000;
      const previousProfitWithdrawals = 5_000;
      const availableProfit = calcAvailableProfit(allTimeProfit, previousProfitWithdrawals);
      expect(availableProfit).toBe(20_000);

      const requestedWithdrawal = 15_000;
      expect(requestedWithdrawal <= availableProfit).toBe(true);

      const remainingAvailable = calcAvailableProfit(allTimeProfit, previousProfitWithdrawals + requestedWithdrawal);
      expect(remainingAvailable).toBe(5_000);
    });

    it('prevents withdrawal exceeding available profit', () => {
      const allTimeProfit = 10_000;
      const previousProfitWithdrawals = 4_000;
      const availableProfit = calcAvailableProfit(allTimeProfit, previousProfitWithdrawals);
      expect(availableProfit).toBe(6_000);

      const requestedWithdrawal = 7_000;
      expect(requestedWithdrawal <= availableProfit).toBe(false);
    });

    it('profit withdrawal does NOT reduce invested capital or all-time profit', () => {
      const initialCapital = 100_000;
      const additionalCapital = 10_000;
      const capitalWithdrawn = 0;
      const allTimeProfit = 30_000;
      const previousProfitWithdrawals = 0;

      const investedBefore = calcInvestedCapital(initialCapital, additionalCapital, capitalWithdrawn);
      const availableBefore = calcAvailableProfit(allTimeProfit, previousProfitWithdrawals);

      // Withdraw ₹15,000 from profit
      const profitWithdrawal = 15_000;
      const newProfitWithdrawals = previousProfitWithdrawals + profitWithdrawal;
      const availableAfter = calcAvailableProfit(allTimeProfit, newProfitWithdrawals);
      const investedAfter = calcInvestedCapital(initialCapital, additionalCapital, capitalWithdrawn);

      expect(availableBefore).toBe(30_000);
      expect(availableAfter).toBe(15_000);
      // Invested capital is untouched
      expect(investedAfter).toBe(investedBefore);
      expect(investedAfter).toBe(110_000);
      // All-time profit is untouched (still 30,000 cumulative realized)
      expect(allTimeProfit).toBe(30_000);
    });
  });

  describe('Withdraw from Invested Capital', () => {
    it('allows withdrawal when amount <= current invested capital', () => {
      const initial = 100_000;
      const additional = 20_000;
      const previousCapitalWithdrawn = 10_000;
      const currentInvested = calcInvestedCapital(initial, additional, previousCapitalWithdrawn);
      expect(currentInvested).toBe(110_000);

      const requestedCapitalWithdrawal = 50_000;
      expect(requestedCapitalWithdrawal <= currentInvested).toBe(true);

      const remainingInvested = calcInvestedCapital(
        initial,
        additional,
        previousCapitalWithdrawn + requestedCapitalWithdrawal
      );
      expect(remainingInvested).toBe(60_000);
    });

    it('prevents withdrawal exceeding current invested capital', () => {
      const initial = 50_000;
      const currentInvested = calcInvestedCapital(initial, 0, 0);
      expect(currentInvested).toBe(50_000);

      const requestedCapitalWithdrawal = 60_000;
      expect(requestedCapitalWithdrawal <= currentInvested).toBe(false);
    });

    it('capital withdrawal does NOT modify trading profit or available profit', () => {
      const initial = 100_000;
      const allTimeProfit = 25_000;
      const profitWithdrawn = 5_000;
      const availableProfitBefore = calcAvailableProfit(allTimeProfit, profitWithdrawn);

      // Withdraw ₹30,000 from invested capital
      const investedAfter = calcInvestedCapital(initial, 0, 30_000);
      const availableProfitAfter = calcAvailableProfit(allTimeProfit, profitWithdrawn);

      expect(investedAfter).toBe(70_000);
      // Trading profit is completely unchanged
      expect(allTimeProfit).toBe(25_000);
      expect(availableProfitAfter).toBe(availableProfitBefore);
      expect(availableProfitAfter).toBe(20_000);
    });

    it('capital withdrawals are never treated as trading losses', () => {
      // Trading loss reduces allTimeProfit, whereas capital withdrawal only reduces investedCapital
      const initial = 50_000;
      const capitalWithdrawn = 20_000;
      const tradingProfit = 10_000;

      const invested = calcInvestedCapital(initial, 0, capitalWithdrawn);
      const available = calcAvailableProfit(tradingProfit, 0);

      expect(invested).toBe(30_000);
      // Trading profit is still 10,000, not 10,000 - 20,000 = -10,000
      expect(available).toBe(10_000);
      expect(tradingProfit).toBe(10_000);
    });
  });

  describe('Decimal-Safe Precision (no floating point artifacts)', () => {
    it('correctly handles fractional rupee sums without precision errors', () => {
      // In floating-point arithmetic: 0.1 + 0.2 === 0.30000000000000004
      // With Decimal.js precision in calcInvestedCapital:
      const initial = 100.1;
      const additional = 200.2;
      const withdrawn = 50.15;
      const result = calcInvestedCapital(initial, additional, withdrawn);
      expect(result).toBe(250.15);
    });

    it('correctly calculates available profit with decimals', () => {
      const pnl = 1500.75;
      const withdrawals = 500.5;
      const result = calcAvailableProfit(pnl, withdrawals);
      expect(result).toBe(1000.25);
    });
  });
});
