/**
 * TradeVault — R-Multiple Unit Tests
 *
 * Tests all core functions in the r-multiple calculation library.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateInitialRisk,
  calculateRealizedR,
  calculateFloatingR,
  classifyROutcome,
  calculateRExpectancy,
  validateTrailingStopUpdate,
  bucketRMultiples,
  R_BUCKETS,
} from '../r-multiple';

// ============================================================
// calculateInitialRisk
// ============================================================

describe('calculateInitialRisk', () => {
  it('computes correct risk for LONG trade', () => {
    const result = calculateInitialRisk({
      entryPrice: 1000,
      initialStopLoss: 950,
      quantity: 100,
      direction: 'LONG',
    });

    expect(result).not.toBeNull();
    expect(result!.riskPerShare).toBe(50);
    expect(result!.riskRupees).toBe(5000);
    expect(result!.riskPct).toBeCloseTo(5, 4);
    expect(result!.r1Price).toBe(1050);
    expect(result!.r2Price).toBe(1100);
    expect(result!.r3Price).toBe(1150);
    expect(result!.r4Price).toBe(1200);
  });

  it('computes correct risk for SHORT trade', () => {
    const result = calculateInitialRisk({
      entryPrice: 500,
      initialStopLoss: 530,
      quantity: 200,
      direction: 'SHORT',
    });

    expect(result).not.toBeNull();
    expect(result!.riskPerShare).toBe(30);
    expect(result!.riskRupees).toBe(6000);
    expect(result!.r1Price).toBe(470);  // SHORT profits by going down
    expect(result!.r2Price).toBe(440);
    expect(result!.r3Price).toBe(410);
  });

  it('returns null when LONG stop is ABOVE entry', () => {
    const result = calculateInitialRisk({
      entryPrice: 1000,
      initialStopLoss: 1050,  // invalid for LONG
      quantity: 100,
      direction: 'LONG',
    });
    expect(result).toBeNull();
  });

  it('returns null when SHORT stop is BELOW entry', () => {
    const result = calculateInitialRisk({
      entryPrice: 500,
      initialStopLoss: 480,  // invalid for SHORT
      quantity: 100,
      direction: 'SHORT',
    });
    expect(result).toBeNull();
  });

  it('returns null for zero or negative inputs', () => {
    expect(calculateInitialRisk({ entryPrice: 0, initialStopLoss: 950, quantity: 100, direction: 'LONG' })).toBeNull();
    expect(calculateInitialRisk({ entryPrice: 1000, initialStopLoss: 0, quantity: 100, direction: 'LONG' })).toBeNull();
    expect(calculateInitialRisk({ entryPrice: 1000, initialStopLoss: 950, quantity: 0, direction: 'LONG' })).toBeNull();
  });

  it('computes planned R:R for LONG with valid target', () => {
    const result = calculateInitialRisk({
      entryPrice: 1000,
      initialStopLoss: 950,
      quantity: 100,
      direction: 'LONG',
      plannedTarget: 1150,  // 150 reward / 50 risk = 3R
    });
    expect(result!.plannedRR).toBe(3);
  });

  it('returns null plannedRR when target is on wrong side', () => {
    const result = calculateInitialRisk({
      entryPrice: 1000,
      initialStopLoss: 950,
      quantity: 100,
      direction: 'LONG',
      plannedTarget: 900,  // below entry — invalid for LONG
    });
    expect(result!.plannedRR).toBeNull();
  });

  it('computes risk percent correctly', () => {
    const result = calculateInitialRisk({
      entryPrice: 2000,
      initialStopLoss: 1900,
      quantity: 50,
      direction: 'LONG',
    });
    expect(result!.riskPct).toBeCloseTo(5, 2);  // 100/2000 = 5%
  });
});

// ============================================================
// calculateRealizedR
// ============================================================

describe('calculateRealizedR', () => {
  it('computes positive R for profitable trade', () => {
    const result = calculateRealizedR({
      netPnl: 7500,
      grossPnl: 8000,
      riskRupees: 5000,
    });
    expect(result).not.toBeNull();
    expect(result!.realizedR).toBe(1.5);
    expect(result!.grossR).toBe(1.6);
  });

  it('computes negative R for losing trade', () => {
    const result = calculateRealizedR({
      netPnl: -4800,
      grossPnl: -4500,
      riskRupees: 5000,
    });
    expect(result!.realizedR).toBe(-0.96);
    expect(result!.grossR).toBe(-0.9);
  });

  it('computes exactly -1R for trade hitting stop', () => {
    // 50 risk per share × 100 qty = 5000 risk; minus small charges makes it slightly below -1R
    const result = calculateRealizedR({
      netPnl: -5000,
      grossPnl: -5000,
      riskRupees: 5000,
    });
    expect(result!.realizedR).toBe(-1);
    expect(result!.grossR).toBe(-1);
  });

  it('returns null when riskRupees is 0', () => {
    expect(calculateRealizedR({ netPnl: 100, grossPnl: 100, riskRupees: 0 })).toBeNull();
  });
});

// ============================================================
// calculateFloatingR
// ============================================================

describe('calculateFloatingR', () => {
  it('returns correct floating R', () => {
    expect(calculateFloatingR(2500, 5000)).toBe(0.5);
    expect(calculateFloatingR(-3000, 5000)).toBe(-0.6);
  });

  it('returns null for zero riskRupees', () => {
    expect(calculateFloatingR(1000, 0)).toBeNull();
  });
});

// ============================================================
// classifyROutcome
// ============================================================

describe('classifyROutcome', () => {
  it('classifies big_winner correctly', () => {
    expect(classifyROutcome(3.5)).toBe('big_winner');
    expect(classifyROutcome(2.1)).toBe('big_winner');
  });

  it('classifies winner correctly', () => {
    expect(classifyROutcome(1.5)).toBe('winner');
    expect(classifyROutcome(1.0)).toBe('winner');
  });

  it('classifies small_winner correctly', () => {
    expect(classifyROutcome(0.5)).toBe('small_winner');
    expect(classifyROutcome(0)).toBe('small_winner');
  });

  it('classifies scratch correctly', () => {
    expect(classifyROutcome(-0.1)).toBe('scratch');
    expect(classifyROutcome(-0.24)).toBe('scratch');
  });

  it('classifies small_loss correctly', () => {
    expect(classifyROutcome(-0.5)).toBe('small_loss');
    expect(classifyROutcome(-0.99)).toBe('small_loss');
  });

  it('classifies full_loss correctly', () => {
    expect(classifyROutcome(-1.0)).toBe('full_loss');
  });

  it('classifies big_loss correctly', () => {
    expect(classifyROutcome(-1.5)).toBe('big_loss');
    expect(classifyROutcome(-3)).toBe('big_loss');
  });
});

// ============================================================
// calculateRExpectancy
// ============================================================

describe('calculateRExpectancy', () => {
  it('computes positive expectancy for good system', () => {
    // 60% win rate, avg win 2R, avg loss 1R → 0.6*2 - 0.4*1 = 0.8R
    expect(calculateRExpectancy(0.6, 2, 1)).toBeCloseTo(0.8, 4);
  });

  it('computes zero expectancy for breakeven system', () => {
    // 50% win, 1R win, 1R loss
    expect(calculateRExpectancy(0.5, 1, 1)).toBeCloseTo(0, 4);
  });

  it('computes negative expectancy for bad system', () => {
    // 40% win, 1R avg win, 1R avg loss → 0.4*1 - 0.6*1 = -0.2
    expect(calculateRExpectancy(0.4, 1, 1)).toBeCloseTo(-0.2, 4);
  });
});

// ============================================================
// validateTrailingStopUpdate
// ============================================================

describe('validateTrailingStopUpdate', () => {
  it('allows LONG trailing stop moved up', () => {
    const result = validateTrailingStopUpdate('LONG', 950, 970, 1000);
    expect(result.valid).toBe(true);
  });

  it('rejects LONG trailing stop moved down', () => {
    const result = validateTrailingStopUpdate('LONG', 950, 930, 1000);
    expect(result.valid).toBe(false);
  });

  it('allows SHORT trailing stop moved down', () => {
    const result = validateTrailingStopUpdate('SHORT', 530, 510, 500);
    expect(result.valid).toBe(true);
  });

  it('rejects SHORT trailing stop moved up', () => {
    const result = validateTrailingStopUpdate('SHORT', 530, 550, 500);
    expect(result.valid).toBe(false);
  });

  it('rejects zero stop price', () => {
    const result = validateTrailingStopUpdate('LONG', 950, 0, 1000);
    expect(result.valid).toBe(false);
  });
});

// ============================================================
// bucketRMultiples
// ============================================================

describe('bucketRMultiples', () => {
  it('distributes R values into correct buckets', () => {
    const rValues = [-3, -1.5, -0.5, 0.5, 1.5, 3];
    const buckets = bucketRMultiples(rValues);

    expect(buckets).toHaveLength(R_BUCKETS.length);

    const bigLoss = buckets.find((b) => b.bucket.label === '< -2R');
    expect(bigLoss?.count).toBe(1);  // -3

    const loss = buckets.find((b) => b.bucket.label === '-2R to -1R');
    expect(loss?.count).toBe(1);  // -1.5

    const smLoss = buckets.find((b) => b.bucket.label === '-1R to 0R');
    expect(smLoss?.count).toBe(1);  // -0.5

    const smWin = buckets.find((b) => b.bucket.label === '0R to 1R');
    expect(smWin?.count).toBe(1);  // 0.5

    const winner = buckets.find((b) => b.bucket.label === '1R to 2R');
    expect(winner?.count).toBe(1);  // 1.5

    const bigWin = buckets.find((b) => b.bucket.label === '> 2R');
    expect(bigWin?.count).toBe(1);  // 3
  });

  it('returns zero counts for empty array', () => {
    const buckets = bucketRMultiples([]);
    buckets.forEach((b) => expect(b.count).toBe(0));
  });
});
