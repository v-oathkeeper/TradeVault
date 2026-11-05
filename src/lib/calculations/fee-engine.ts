/**
 * TradeVault Fee Engine — Core Orchestrator
 * 
 * Calculates all broker charges for a trade using the fee rates
 * retrieved from the database. Independent of all UI components.
 * 
 * Usage:
 *   const breakdown = calculateFees(input);
 *   const netPnl = grossPnl - breakdown.totalCharges;
 */

import {
  Decimal,
  toDecimal,
  roundToINR,
  roundTo4,
  sumDecimals,
  applyRate,
  applyRateWithCap,
  calcTurnover,
} from './decimal-utils';
import type {
  FeeCalculationInput,
  FeeRate,
  FeeRateSnapshot,
  ChargeBreakdown,
  TradeExecution,
  BrokerCode,
} from './types';

// ============================================================
// HELPER: Find a fee rate from the snapshot
// ============================================================
function findRate(
  rates: FeeRate[],
  chargeType: string,
  side?: 'BUY' | 'SELL'
): FeeRate | undefined {
  return rates.find(r => {
    if (r.chargeType !== chargeType) return false;
    if (side) {
      return r.appliesToSide === side || r.appliesToSide === 'BOTH';
    }
    return true;
  });
}

// ============================================================
// HELPER: Calculate turnover for a set of executions by side
// ============================================================
function calcSideTurnover(executions: TradeExecution[], side: 'BUY' | 'SELL'): Decimal {
  return executions
    .filter(e => e.side === side)
    .reduce((acc, e) => {
      return acc.plus(calcTurnover(toDecimal(e.price), e.quantity));
    }, new Decimal(0));
}

// ============================================================
// HELPER: Calculate brokerage per execution (respecting cap)
// ============================================================
function calcBrokerageForExecutions(
  executions: TradeExecution[],
  rates: FeeRate[]
): Decimal {
  const brokerageRate = findRate(rates, 'BROKERAGE');
  if (!brokerageRate || brokerageRate.rate === 0) return new Decimal(0);

  let total = new Decimal(0);

  // Group by broker_order_id to avoid double-capping partial fills
  const orderGroups = new Map<string, TradeExecution[]>();
  for (const exec of executions) {
    const key = exec.brokerOrderId || `${exec.side}-${exec.price}-${exec.quantity}`;
    if (!orderGroups.has(key)) orderGroups.set(key, []);
    orderGroups.get(key)!.push(exec);
  }

  for (const [, orderExecs] of orderGroups) {
    const orderTurnover = orderExecs.reduce(
      (acc: Decimal, e: TradeExecution) => acc.plus(calcTurnover(toDecimal(e.price), e.quantity)),
      new Decimal(0)
    );
    const brokerage = applyRateWithCap(
      orderTurnover,
      brokerageRate.rate,
      brokerageRate.maxPerOrder
    );
    total = total.plus(brokerage);
  }

  return roundToINR(total);
}

// ============================================================
// MAIN FEE CALCULATION ENGINE
// ============================================================
export function calculateFees(input: FeeCalculationInput): ChargeBreakdown {
  const { broker, exchange, tradeType, executions, feeRates, isDpEvent } = input;
  const rates = feeRates.rates;

  // ── Turnover by side ──────────────────────────────────────
  const buyTurnover = calcSideTurnover(executions, 'BUY');
  const sellTurnover = calcSideTurnover(executions, 'SELL');
  const totalTurnover = buyTurnover.plus(sellTurnover);

  // ── BROKERAGE ─────────────────────────────────────────────
  // Per order, with cap. Delivery = Rs 0 for both brokers.
  const brokerage = calcBrokerageForExecutions(executions, rates);

  // ── STT ───────────────────────────────────────────────────
  // INTRADAY: sell side only
  // DELIVERY: both sides
  let stt = new Decimal(0);
  if (tradeType === 'INTRADAY') {
    const sttRate = findRate(rates, 'STT', 'SELL');
    if (sttRate) {
      stt = roundToINR(applyRate(sellTurnover, sttRate.rate));
    }
  } else {
    // DELIVERY
    const sttRateBuy = findRate(rates, 'STT', 'BUY');
    const sttRateSell = findRate(rates, 'STT', 'SELL');
    if (sttRateBuy) stt = stt.plus(applyRate(buyTurnover, sttRateBuy.rate));
    if (sttRateSell) stt = stt.plus(applyRate(sellTurnover, sttRateSell.rate));
    stt = roundToINR(stt);
  }

  // ── EXCHANGE TRANSACTION CHARGES ─────────────────────────
  // Applied to both buy and sell turnover
  let exchangeCharges = new Decimal(0);
  const excRateBuy = findRate(rates, 'EXCHANGE_TXN', 'BUY');
  const excRateSell = findRate(rates, 'EXCHANGE_TXN', 'SELL');
  // Most exchange charges apply to BOTH sides with same rate
  const excRateBoth = findRate(rates, 'EXCHANGE_TXN');
  if (excRateBoth && excRateBoth.appliesToSide === 'BOTH') {
    exchangeCharges = roundToINR(applyRate(totalTurnover, excRateBoth.rate));
  } else {
    if (excRateBuy) exchangeCharges = exchangeCharges.plus(applyRate(buyTurnover, excRateBuy.rate));
    if (excRateSell) exchangeCharges = exchangeCharges.plus(applyRate(sellTurnover, excRateSell.rate));
    exchangeCharges = roundToINR(exchangeCharges);
  }

  // ── SEBI CHARGES ──────────────────────────────────────────
  let sebiCharges = new Decimal(0);
  const sebiRate = findRate(rates, 'SEBI');
  if (sebiRate) {
    const sebiBase = sebiRate.appliesToSide === 'BOTH' ? totalTurnover
      : sebiRate.appliesToSide === 'BUY' ? buyTurnover : sellTurnover;
    sebiCharges = roundToINR(applyRate(sebiBase, sebiRate.rate));
  }

  // ── STAMP DUTY ────────────────────────────────────────────
  // Always buy side only
  let stampDuty = new Decimal(0);
  const stampRate = findRate(rates, 'STAMP_DUTY', 'BUY');
  if (stampRate && buyTurnover.greaterThan(0)) {
    stampDuty = roundToINR(applyRate(buyTurnover, stampRate.rate));
  }

  // ── IPFT ─────────────────────────────────────────────────
  // Shoonya NSE: Rs 0.01 per crore. 0 for Zerodha and BSE (by default).
  let ipft = new Decimal(0);
  const ipftRate = findRate(rates, 'IPFT');
  if (ipftRate) {
    const ipftBase = ipftRate.appliesToSide === 'BOTH' ? totalTurnover
      : ipftRate.appliesToSide === 'BUY' ? buyTurnover : sellTurnover;
    ipft = roundToINR(applyRate(ipftBase, ipftRate.rate));
  }

  // ── DP CHARGES ────────────────────────────────────────────
  // Only for DELIVERY trades with an actual scrip debit event.
  // NOT charged on intraday. Charged once per scrip per sell day.
  let dpCharges = new Decimal(0);
  if (tradeType === 'DELIVERY' && isDpEvent) {
    const dpRate = findRate(rates, 'DP', 'SELL');
    if (dpRate) {
      if (dpRate.calculationBasis === 'FLAT_PER_EVENT') {
        // Flat charge per scrip debit event
        let dpBase = toDecimal(dpRate.rate);
        // Shoonya DP has GST applied separately (handled in GST calculation below)
        // Zerodha DP of Rs 15.34 already includes all charges (no additional GST)
        // We track the base here and GST is added in the GST section for brokers that need it
        dpCharges = roundToINR(dpBase);
      } else {
        dpCharges = roundToINR(applyRate(sellTurnover, dpRate.rate));
      }
    }
  }

  // ── GST ───────────────────────────────────────────────────
  // 18% on: brokerage + exchange charges + SEBI charges
  // For Shoonya: also on IPFT and DP (which is listed as Rs 9 base + GST)
  // NOT on: STT, stamp duty
  const gstRate = findRate(rates, 'GST');
  let gstBase = brokerage.plus(exchangeCharges).plus(sebiCharges);

  // Add IPFT to GST base if applicable
  if (ipft.greaterThan(0)) {
    gstBase = gstBase.plus(ipft);
  }

  // For Shoonya: DP base (Rs 9) has GST applied to it
  // Zerodha DP (Rs 15.34) is already the final amount
  if (tradeType === 'DELIVERY' && isDpEvent && broker === 'SHOONYA' && dpCharges.greaterThan(0)) {
    gstBase = gstBase.plus(dpCharges);
    // Recalculate DP total = base + GST
    // The dpCharges already reflects the base; GST will be added separately
  }

  let gst = new Decimal(0);
  if (gstRate) {
    gst = roundToINR(applyRate(gstBase, gstRate.rate));
  }

  // For Shoonya: add GST back to DP to get actual DP total
  if (broker === 'SHOONYA' && tradeType === 'DELIVERY' && isDpEvent && dpCharges.greaterThan(0)) {
    // The GST calculation already includes the DP base, but we want to show
    // DP charges as the base amount (Rs 9) in the breakdown for clarity.
    // Total DP cost is effectively Rs 9 + (Rs 9 × 18% GST) = Rs 10.62
    // This is already reflected in the total since gst includes it.
  }

  // ── TOTAL CHARGES ─────────────────────────────────────────
  const totalCharges = roundToINR(
    sumDecimals([brokerage, stt, exchangeCharges, sebiCharges, gst, stampDuty, ipft, dpCharges])
  );

  return {
    brokerage: brokerage.toNumber(),
    stt: stt.toNumber(),
    exchangeCharges: exchangeCharges.toNumber(),
    sebiCharges: sebiCharges.toNumber(),
    gst: gst.toNumber(),
    stampDuty: stampDuty.toNumber(),
    ipft: ipft.toNumber(),
    dpCharges: dpCharges.toNumber(),
    otherCharges: 0,
    totalCharges: totalCharges.toNumber(),
    grossPnl: 0, // Set by the caller after P&L calculation
    netPnl: 0,   // Set by the caller
    calculationStatus: 'ESTIMATED',
    feeRatesSnapshot: feeRates,
    calculatedAt: new Date().toISOString(),
    buyTurnover: roundToINR(buyTurnover).toNumber(),
    sellTurnover: roundToINR(sellTurnover).toNumber(),
    totalTurnover: roundToINR(totalTurnover).toNumber(),
  };
}

/**
 * Calculate fees for a simple single-entry, single-exit trade.
 * This is the most common use case.
 */
export function calculateFeesForTrade(params: {
  broker: BrokerCode;
  exchange: 'NSE' | 'BSE';
  tradeType: 'INTRADAY' | 'DELIVERY';
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  feeRates: FeeRateSnapshot;
  isDpEvent?: boolean;
}): ChargeBreakdown {
  const { direction, entryPrice, exitPrice, quantity } = params;

  // Build execution legs
  const executions: TradeExecution[] = direction === 'LONG'
    ? [
        { side: 'BUY', price: entryPrice, quantity },
        { side: 'SELL', price: exitPrice, quantity },
      ]
    : [
        { side: 'SELL', price: entryPrice, quantity },
        { side: 'BUY', price: exitPrice, quantity },
      ];

  return calculateFees({
    broker: params.broker,
    exchange: params.exchange,
    tradeType: params.tradeType,
    direction: params.direction,
    executions,
    feeRates: params.feeRates,
    isDpEvent: params.isDpEvent ?? (params.tradeType === 'DELIVERY'),
    symbol: undefined,
  });
}
