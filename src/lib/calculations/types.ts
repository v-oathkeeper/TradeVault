/**
 * TradeVault Fee Engine — Core Types
 * 
 * All types used across the fee calculation system.
 */

export type BrokerCode = 'KITE' | 'SHOONYA';
export type ExchangeCode = 'NSE' | 'BSE';
export type TradeType = 'INTRADAY' | 'DELIVERY';
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeSide = 'BUY' | 'SELL';
export type CalculationBasis = 'TURNOVER_PCT' | 'FLAT_PER_EVENT' | 'FLAT_PER_CRORE' | 'ON_SERVICE_CHARGES';

/**
 * A single execution leg (buy or sell) of a trade.
 */
export interface TradeExecution {
  side: TradeSide;
  price: number;        // Entry or exit price per unit
  quantity: number;     // Number of units
  executedAt?: Date;
  brokerOrderId?: string; // For grouping partial fills
}

/**
 * A fee rate row from the database (broker_fee_rates table).
 */
export interface FeeRate {
  chargeType: string;           // 'BROKERAGE', 'STT', 'EXCHANGE_TXN', etc.
  rate: number;                 // Decimal fraction (e.g., 0.0003)
  maxPerOrder: number | null;   // Cap in INR, null if no cap
  appliesToSide: 'BUY' | 'SELL' | 'BOTH';
  calculationBasis: CalculationBasis;
  securityGroup: string | null;
}

/**
 * A snapshot of all fee rates for a specific broker/exchange/trade-type combo.
 * This snapshot is stored with each trade for historical accuracy.
 */
export interface FeeRateSnapshot {
  brokerId: string;
  brokerCode: BrokerCode;
  exchange: ExchangeCode;
  productType: TradeType;
  rates: FeeRate[];
  capturedAt: string; // ISO timestamp
  sourceUrl?: string;
}

/**
 * Input to the fee calculation engine.
 */
export interface FeeCalculationInput {
  broker: BrokerCode;
  exchange: ExchangeCode;
  tradeType: TradeType;
  direction: TradeDirection;
  executions: TradeExecution[];   // All buy/sell legs
  feeRates: FeeRateSnapshot;
  isDpEvent: boolean;             // Is this a delivery sell that triggers DP?
  symbol?: string;
}

/**
 * Detailed, itemized charge breakdown.
 * All values are in INR (as numbers after Decimal calculation).
 */
export interface ChargeBreakdown {
  // Individual charges
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  sebiCharges: number;
  gst: number;
  stampDuty: number;
  ipft: number;
  dpCharges: number;
  otherCharges: number;

  // Summary
  totalCharges: number;

  // P&L components
  grossPnl: number;
  netPnl: number;

  // Metadata
  calculationStatus: 'ESTIMATED' | 'RECONCILED';
  feeRatesSnapshot: FeeRateSnapshot;
  calculatedAt: string;

  // Intermediate values for transparency
  buyTurnover: number;
  sellTurnover: number;
  totalTurnover: number;
}

/**
 * Input specifically for gross P&L calculation.
 */
export interface PnlInput {
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
}

/**
 * Result from the P&L calculator.
 */
export interface PnlResult {
  grossPnl: number;
  totalCharges: number;
  netPnl: number;
  chargeBreakdown: ChargeBreakdown;
}

/**
 * For open positions — unrealized P&L estimation.
 */
export interface UnrealizedPnlInput {
  direction: TradeDirection;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  feeRates: FeeRateSnapshot;
  broker: BrokerCode;
  exchange: ExchangeCode;
  tradeType: TradeType;
}

export interface UnrealizedPnlResult {
  unrealizedGrossPnl: number;
  estimatedExitCharges: number;
  unrealizedNetPnl: number;
  currentPrice: number;
  investedAmount: number;
}
