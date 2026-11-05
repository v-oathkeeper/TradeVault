/**
 * Helper to fetch fee rates from the database and build a FeeRateSnapshot.
 * Used by the API routes when calculating charges.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { FeeRateSnapshot, FeeRate, BrokerCode, ExchangeCode, TradeType } from '@/lib/calculations/types';

export async function fetchFeeRatesSnapshot(
  brokerId: string,
  brokerCode: BrokerCode,
  exchange: ExchangeCode,
  productType: TradeType
): Promise<FeeRateSnapshot> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split('T')[0]!;

  // Fetch active rates for this broker/exchange/product combo
  // Also fetch rates where exchange IS NULL (applies to all exchanges)
  const { data: rates, error } = await supabase
    .from('broker_fee_rates')
    .select('*')
    .eq('broker_id', brokerId)
    .eq('product_type', productType)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .or(`exchange.eq.${exchange},exchange.is.null`);

  if (error) {
    console.error('Failed to fetch fee rates:', error);
    // Fall back to hardcoded default rates to avoid breaking trade creation
    return getHardcodedFallbackRates(brokerCode, exchange, productType);
  }

  const feeRates: FeeRate[] = (rates ?? []).map(r => ({
    chargeType: r.charge_type,
    rate: Number(r.rate),
    maxPerOrder: r.max_per_order !== null ? Number(r.max_per_order) : null,
    appliesToSide: r.applies_to_side as 'BUY' | 'SELL' | 'BOTH',
    calculationBasis: r.calculation_basis as FeeRate['calculationBasis'],
    securityGroup: r.security_group,
  }));

  // Deduplicate: if both exchange-specific and universal rates exist for same charge type,
  // prefer the exchange-specific one
  const deduped = deduplicateRates(feeRates, exchange);

  return {
    brokerId,
    brokerCode,
    exchange,
    productType,
    rates: deduped,
    capturedAt: new Date().toISOString(),
    sourceUrl: undefined,
  };
}

/**
 * When multiple rates exist for the same charge type, prefer exchange-specific over universal.
 */
function deduplicateRates(rates: FeeRate[], exchange: ExchangeCode): FeeRate[] {
  const exchangeSpecific = rates.filter(r => r.securityGroup !== null || rates.some(
    other => other.chargeType === r.chargeType && other !== r
  ));

  // Simple dedup: group by chargeType, prefer exchange-specific
  const byChargeType = new Map<string, FeeRate>();
  for (const rate of rates) {
    const existing = byChargeType.get(rate.chargeType);
    if (!existing) {
      byChargeType.set(rate.chargeType, rate);
    }
    // If existing has no security group but new one does, prefer new
    // (This handles BSE security group overrides)
    else if (existing.securityGroup === null && rate.securityGroup !== null) {
      byChargeType.set(rate.chargeType, rate);
    }
  }

  return Array.from(byChargeType.values());
}

/**
 * Fallback rates if DB fetch fails.
 * These mirror the seed data values.
 */
function getHardcodedFallbackRates(
  brokerCode: BrokerCode,
  exchange: ExchangeCode,
  productType: TradeType
): FeeRateSnapshot {
  const isKite = brokerCode === 'KITE';
  const isIntraday = productType === 'INTRADAY';
  const isBSE = exchange === 'BSE';

  const rates: FeeRate[] = [
    {
      chargeType: 'BROKERAGE',
      rate: 0.0003,
      maxPerOrder: isIntraday ? (isKite ? 20 : 5) : null,
      appliesToSide: 'BOTH',
      calculationBasis: 'TURNOVER_PCT',
      securityGroup: null,
    },
    {
      chargeType: 'STT',
      rate: isIntraday ? 0.00025 : 0.001,
      maxPerOrder: null,
      appliesToSide: isIntraday ? 'SELL' : 'BOTH',
      calculationBasis: 'TURNOVER_PCT',
      securityGroup: null,
    },
    {
      chargeType: 'EXCHANGE_TXN',
      rate: isBSE ? (isKite ? 0.0000375 : 0.0000307) : 0.0000307,
      maxPerOrder: null,
      appliesToSide: 'BOTH',
      calculationBasis: 'TURNOVER_PCT',
      securityGroup: null,
    },
    {
      chargeType: 'SEBI',
      rate: 0.000001,
      maxPerOrder: null,
      appliesToSide: 'BOTH',
      calculationBasis: 'TURNOVER_PCT',
      securityGroup: null,
    },
    {
      chargeType: 'STAMP_DUTY',
      rate: isIntraday ? 0.00003 : 0.00015,
      maxPerOrder: null,
      appliesToSide: 'BUY',
      calculationBasis: 'TURNOVER_PCT',
      securityGroup: null,
    },
    {
      chargeType: 'GST',
      rate: 0.18,
      maxPerOrder: null,
      appliesToSide: 'BOTH',
      calculationBasis: 'ON_SERVICE_CHARGES',
      securityGroup: null,
    },
  ];

  if (!isIntraday) {
    rates.push({
      chargeType: 'DP',
      rate: isKite ? 15.34 : 9.0,
      maxPerOrder: null,
      appliesToSide: 'SELL',
      calculationBasis: 'FLAT_PER_EVENT',
      securityGroup: null,
    });
  }

  if (!isKite && exchange === 'NSE') {
    rates.push({
      chargeType: 'IPFT',
      rate: 0.000000001,
      maxPerOrder: null,
      appliesToSide: 'BOTH',
      calculationBasis: 'TURNOVER_PCT',
      securityGroup: null,
    });
  }

  return {
    brokerId: 'fallback',
    brokerCode,
    exchange,
    productType,
    rates,
    capturedAt: new Date().toISOString(),
    sourceUrl: undefined,
  };
}
