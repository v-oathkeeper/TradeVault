/**
 * TradeVault — Weekly Trading Report Types
 * Schema Version 1.0
 */

export interface WeeklyReportFilters {
  portfolio_owner: string; // 'COMBINED' | person display name | UUID
  portfolio_owner_id?: string | null;
  strategy: 'BOTH' | 'INTRADAY' | 'SWING';
  broker: 'ALL' | 'ZERODHA' | 'SHOONYA';
}

export interface DirectionalBreakdown {
  trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number | null;
  gross_pnl: number;
  total_charges: number;
  net_pnl: number;
  avg_r_multiple: number | null;
}

export interface BrokerPerformanceItem {
  broker_code: 'KITE' | 'SHOONYA';
  broker_name: string;
  trades: number;
  wins: number;
  losses: number;
  win_rate: number | null;
  gross_pnl: number;
  total_charges: number;
  net_pnl: number;
  avg_r_multiple: number | null;
}

export interface ExtremeTradeItem {
  trade_id: string;
  symbol: string;
  net_pnl: number;
  realized_r: number | null;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number | null;
}

export interface WeeklyPerformanceSummary {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  breakeven_trades: number;
  win_rate: number | null; // % (0-100) or null
  gross_realized_pnl: number;
  total_charges: number;
  net_realized_pnl: number;
  average_profit_per_trade: number | null;
  average_loss_per_trade: number | null;
  largest_winner: ExtremeTradeItem | null;
  largest_loser: ExtremeTradeItem | null;
  average_realized_r_multiple: number | null;
  average_winning_r: number | null;
  average_losing_r: number | null;
  profit_factor: number | null;
  expectancy: number | null; // net pnl per trade
  r_expectancy: number | null; // R units per trade
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  total_initial_risk: number;
  average_risk_per_trade: number | null;
  trading_days: number;
  trades_per_day: number | null;
  average_holding_period: string | null;
  long_vs_short: {
    long: DirectionalBreakdown;
    short: DirectionalBreakdown;
  };
  broker_performance: BrokerPerformanceItem[];
}

export interface IntradayTimeOfDayPerformance {
  period: 'morning' | 'afternoon' | 'closing';
  label: string; // e.g. "09:15 - 11:30"
  trades: number;
  net_pnl: number;
  win_rate: number | null;
}

export interface RepeatedSymbolItem {
  symbol: string;
  count: number;
  gross_pnl: number;
  net_pnl: number;
  win_rate: number | null;
}

export interface IntradaySpecificAnalysis {
  average_holding_minutes: number | null;
  time_of_day_performance: IntradayTimeOfDayPerformance[];
  repeated_symbols: RepeatedSymbolItem[];
}

export interface RDistributionBucket {
  range: string;
  min: number;
  max: number;
  count: number;
}

export interface SwingSpecificAnalysis {
  average_holding_days: number | null;
  r_distribution: RDistributionBucket[];
  trades_reaching_r_targets: {
    r1_reached: number;
    r2_reached: number;
    r3_reached: number;
  };
  trades_stopped_at_breakeven_or_profit: number;
  current_open_risk: number;
  estimated_protected_profit: number;
  stop_loss_management_effectiveness: {
    total_stop_updates: number;
    trailed_into_profit: number;
    moved_to_breakeven: number;
  };
}

export interface TradeExecutionItem {
  id: string;
  execution_type: 'ENTRY' | 'EXIT';
  quantity: number;
  price: number;
  executed_at: string;
  broker_order_id: string | null;
  charges: Record<string, unknown> | null;
}

export interface StopLossHistoryItem {
  id: string;
  previous_stop: number | null;
  new_stop: number;
  stop_type: 'INITIAL' | 'TRAIL' | 'BREAKEVEN' | 'PARTIAL_CLOSE' | 'MANUAL';
  sl_level_label: string; // 'BREAKEVEN' | '+1R' | '+2R' | '+3R' | 'TRAIL' | 'MANUAL' | 'INITIAL'
  market_price_at_update: number | null;
  r_multiple_at_update: number | null;
  estimated_profit_protected: number | null;
  remaining_quantity: number | null;
  notes: string | null;
  created_at: string;
  is_broker_confirmed: boolean; // false unless confirmed
}

export interface ReportTradeItem {
  trade_id: string;
  symbol: string;
  portfolio_owner: string;
  portfolio_owner_id: string;
  broker: string;
  broker_code: 'KITE' | 'SHOONYA';
  exchange: 'NSE' | 'BSE';
  trade_type: 'INTRADAY' | 'DELIVERY' | 'SWING';
  db_trade_type: 'INTRADAY' | 'DELIVERY';
  direction: 'LONG' | 'SHORT';
  entry_at: string;
  entry_price: number;
  initial_stop_loss: number;
  current_stop_loss: number;
  target_price: number | null;
  quantity_entered: number;
  quantity_exited: number;
  remaining_quantity: number;
  exit_price: number | null;
  exit_at: string | null;
  gross_realized_pnl: number | null;
  total_charges: number;
  net_realized_pnl: number | null;
  initial_risk_per_share: number | null;
  initial_total_risk: number | null;
  realized_r_multiple: number | null;
  current_unrealized_pnl: number | null;
  estimated_protected_profit: number | null;
  status: 'OPEN' | 'CLOSED';
  strategy: string | null;
  entry_rationale: string | null;
  notes: string | null;
  executions: TradeExecutionItem[];
  stop_loss_history: StopLossHistoryItem[];
}

export interface StrategyReportSection<T = unknown> {
  summary: WeeklyPerformanceSummary & T;
  new_trades: ReportTradeItem[];
  closed_trades: ReportTradeItem[];
  partial_exits: ReportTradeItem[];
  open_positions: ReportTradeItem[];
  stop_loss_updates: StopLossHistoryItem[];
}

export interface PortfolioRiskSummary {
  current_open_risk_rupees: number;
  current_capital_deployed: number;
  estimated_stop_protected_profit: number;
  active_open_positions_count: number;
  risk_to_capital_ratio: number | null;
}

export interface AIReviewMetadata {
  weekly_outcomes: {
    headline: string;
    total_net_pnl: number;
    win_rate: number | null;
    r_expectancy: number | null;
    profit_factor: number | null;
  };
  repeated_symbols: RepeatedSymbolItem[];
  largest_losses: ExtremeTradeItem[];
  trades_with_negative_r: ExtremeTradeItem[];
  trades_where_risk_increased: {
    trade_id: string;
    symbol: string;
    initial_stop_loss: number;
    adjusted_stop_loss: number;
    reason: string | null;
  }[];
  stop_loss_rule_adherence: {
    total_trades_checked: number;
    adhered_count: number;
    violated_count: number;
    notes: string;
  };
  missing_rationales: {
    trade_id: string;
    symbol: string;
    entry_at: string;
  }[];
  incomplete_trades: {
    trade_id: string;
    symbol: string;
    reason: string;
  }[];
}

export interface DataQualityAudit {
  missing_fields: { trade_id: string; symbol: string; field: string }[];
  incomplete_trades: { trade_id: string; symbol: string; issue: string }[];
  calculation_warnings: string[];
}

export interface WeeklyActivitySummary {
  new_trades_opened_this_week: number;
  trades_closed_this_week: number;
  partial_exits_this_week: number;
  open_positions_carried_forward: number;
  stop_loss_updates_this_week: number;
}

/**
 * Top-Level Weekly Trading Review Schema (v1.0)
 */
export interface WeeklyTradingReportJSON {
  report_version: '1.0';
  report_type: 'WEEKLY_TRADING_REVIEW';
  generated_at: string;
  timezone: 'Asia/Kolkata';
  period: {
    start_date: string; // YYYY-MM-DD
    end_date: string;   // YYYY-MM-DD
  };
  filters: WeeklyReportFilters;
  summary: WeeklyPerformanceSummary;
  weekly_activity: WeeklyActivitySummary;
  trades: ReportTradeItem[];
  intraday: StrategyReportSection<IntradaySpecificAnalysis>;
  swing: StrategyReportSection<SwingSpecificAnalysis>;
  portfolio_risk: PortfolioRiskSummary;
  ai_review: AIReviewMetadata;
  data_quality: DataQualityAudit;
}
