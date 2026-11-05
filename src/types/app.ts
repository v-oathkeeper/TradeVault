/**
 * TradeVault — Application Types
 * 
 * Domain types used throughout the application.
 * These are separate from database types (database.ts).
 */

export type UserRole = 'ADMIN' | 'VIEWER';
export type TradeType = 'INTRADAY' | 'DELIVERY';
export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'CLOSED';
export type ExchangeCode = 'NSE' | 'BSE';
export type MovementType = 'DEPOSIT' | 'WITHDRAWAL';
export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';
export type CalculationStatus = 'ESTIMATED' | 'RECONCILED';
export type BrokerCode = 'KITE' | 'SHOONYA';
export type StopLossUpdateType = 'INITIAL' | 'TRAIL' | 'BREAKEVEN' | 'PARTIAL_CLOSE' | 'MANUAL';

/**
 * The authenticated user's context for the current session.
 */
export interface UserContext {
  userId: string;
  email: string;
  householdId: string;
  role: UserRole;
  isAdmin: boolean;
  isViewer: boolean;
  fullName: string;
}

/**
 * A portfolio owner (person) as returned from the DB.
 */
export interface Person {
  id: string;
  householdId: string;
  displayName: string;
  relationshipLabel: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Broker record.
 */
export interface Broker {
  id: string;
  code: BrokerCode;
  name: string;
  websiteUrl: string | null;
  isActive: boolean;
}

/**
 * A trade record as returned from the database.
 */
export interface Trade {
  id: string;
  householdId: string;
  portfolioOwnerId: string;
  brokerId: string;
  symbol: string;
  exchange: ExchangeCode;
  tradeType: TradeType;
  direction: TradeDirection;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  entryAt: string; // ISO timestamp
  exitAt: string | null;
  grossPnl: number | null;
  totalCharges: number;
  netPnl: number | null;
  chargesBreakdown: ChargeBreakdownJSON | null;
  calculationStatus: CalculationStatus;
  status: TradeStatus;
  notes: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;

  // ── R-Multiple & Risk Management Fields ──────────────────
  initialStopLoss?: number | null;
  initialRiskPerShare?: number | null;
  initialRiskRupees?: number | null;
  initialRiskPct?: number | null;
  plannedTarget?: number | null;
  plannedRR?: number | null;
  r1Price?: number | null;
  r2Price?: number | null;
  r3Price?: number | null;
  strategyName?: string | null;
  currentStopLoss?: number | null;
  maxAdverseExcursion?: number | null;
  maxFavorableExcursion?: number | null;
  realizedRMultiple?: number | null;
  grossRMultiple?: number | null;

  // Joined fields (populated by queries)
  portfolioOwner?: {
    id: string;
    displayName?: string;
    display_name?: string;
    relationshipLabel?: string;
    relationship_label?: string;
  };
  broker?: {
    id: string;
    code: BrokerCode;
    name: string;
  };
}

/**
 * Stored charges breakdown JSON structure.
 */
export interface ChargeBreakdownJSON {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  sebiCharges: number;
  gst: number;
  stampDuty: number;
  ipft: number;
  dpCharges: number;
  otherCharges: number;
  totalCharges: number;
  buyTurnover: number;
  sellTurnover: number;
  totalTurnover: number;
  calculationStatus: CalculationStatus;
  feeRatesSnapshot?: unknown;
  calculatedAt: string;
}

/**
 * Stop-loss history entry — full audit trail per trade.
 */
export interface StopLossHistoryEntry {
  id: string;
  tradeId: string;
  previousStop: number | null;
  newStop: number;
  stopType: StopLossUpdateType;
  marketPriceAtUpdate: number | null;
  floatingRAtUpdate: number | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

/**
 * Risk summary for a trade (derived / computed).
 */
export interface RiskSummary {
  riskPerShare: number;
  riskRupees: number;
  riskPct: number;
  r1Price: number;
  r2Price: number;
  r3Price: number;
  r4Price: number;
  plannedRR: number | null;
}

/**
 * Open position with unrealized P&L data.
 */
export interface OpenPosition extends Trade {
  currentPrice: number | null;
  investedAmount: number;
  unrealizedGrossPnl: number | null;
  estimatedExitCharges: number | null;
  unrealizedNetPnl: number | null;
  lastPriceUpdatedAt: string | null;
  /** Floating R-multiple (unrealizedNetPnl / initialRiskRupees) */
  floatingR: number | null;
  /** Distance to current stop-loss in % */
  distanceToStop: number | null;
}

/**
 * Dashboard KPI summary.
 */
export interface DashboardKPIs {
  totalRealizedNetPnl: number;
  currentUnrealizedNetPnl: number;
  totalClosedTrades: number;
  totalOpenPositions: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // 0–100
  totalChargesPaid: number;
  avgRMultiple: number | null;
  rExpectancy: number | null;
}

/**
 * Monthly P&L data point for charts.
 */
export interface MonthlyPnl {
  year: number;
  month: number;
  label: string; // "Jan 2024"
  grossPnl: number;
  netPnl: number;
  totalCharges: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
}

/**
 * Person analytics summary.
 */
export interface PersonAnalytics {
  personId: string;
  displayName: string;
  totalTrades: number;
  closedTrades: number;
  openPositions: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalGrossPnl: number;
  totalCharges: number;
  totalNetPnl: number;
  averageWin: number;
  averageLoss: number;
  intradayNetPnl: number;
  deliveryNetPnl: number;
  kiteNetPnl: number;
  shoonyaNetPnl: number;
  avgRMultiple: number | null;
  rExpectancy: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
}

/**
 * Filter state for dashboard and trade list.
 */
export interface TradeFilters {
  personId?: string | 'all' | 'combined';
  brokerId?: string | 'all';
  tradeType?: TradeType | 'all';
  status?: TradeStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  symbol?: string;
  profitLoss?: 'profit' | 'loss' | 'all';
  strategyName?: string;
}

/**
 * Pagination state.
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Trade form values (used by React Hook Form + Zod)
 * — now includes risk management fields.
 */
export interface TradeFormValues {
  portfolioOwnerId: string;
  brokerId: string;
  tradeType: TradeType;
  direction: TradeDirection;
  symbol: string;
  exchange: ExchangeCode;
  entryPrice: number;
  quantity: number;
  entryAt: string; // ISO string
  initialStopLoss: number;
  plannedTarget?: number | null;
  strategyName?: string | null;
  exitPrice?: number | null;
  exitAt?: string | null;
  notes?: string | null;
}

/**
 * Response envelope for API routes.
 */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

/**
 * R-multiple distribution data for analytics histogram.
 */
export interface RDistributionPoint {
  label: string;
  count: number;
  color: string;
}

/**
 * Strategy R-performance for the bar chart.
 */
export interface StrategyRPerformance {
  strategyName: string;
  avgR: number;
  tradeCount: number;
  winRate: number;
}
