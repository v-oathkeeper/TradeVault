/**
 * TradeVault — Weekly Trading Report Compilation Engine
 *
 * Computes comprehensive weekly review analytics, strategy breakdowns (Intraday MIS vs Swing CNC),
 * trade-level data, stop-loss histories, portfolio risk metrics, and AI review metadata.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  WeeklyReportFilters,
  WeeklyPerformanceSummary,
  IntradaySpecificAnalysis,
  SwingSpecificAnalysis,
  ReportTradeItem,
  TradeExecutionItem,
  StopLossHistoryItem,
  ExtremeTradeItem,
  DirectionalBreakdown,
  BrokerPerformanceItem,
  RepeatedSymbolItem,
  RDistributionBucket,
  PortfolioRiskSummary,
  AIReviewMetadata,
  DataQualityAudit,
  WeeklyTradingReportJSON,
} from '@/types/weekly-report';
import {
  toISTDateString,
  getISTStartOfDayISO,
  getISTEndOfDayISO,
} from '@/lib/calculations/weekly-calendar';

/**
 * Builds the complete Weekly Trading Review JSON payload.
 */
export async function generateWeeklyTradingReport({
  householdId,
  startDate,
  endDate,
  filters,
  supabase,
}: {
  householdId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  filters: WeeklyReportFilters;
  supabase: SupabaseClient<Database>;
}): Promise<WeeklyTradingReportJSON> {
  const windowStartISO = getISTStartOfDayISO(startDate);
  const windowEndISO = getISTEndOfDayISO(endDate);
  const windowStartMs = new Date(windowStartISO).getTime();
  const windowEndMs = new Date(windowEndISO).getTime();

  // 1. Fetch household persons to resolve owner labels
  const { data: personsData } = await supabase
    .from('persons')
    .select('id, display_name, relationship_label')
    .eq('household_id', householdId);

  const personsMap = new Map<string, { displayName: string; relationshipLabel: string }>();
  (personsData || []).forEach((p) => {
    personsMap.set(p.id, {
      displayName: p.display_name,
      relationshipLabel: p.relationship_label,
    });
  });

  // 2. Fetch brokers
  const { data: brokersData } = await supabase
    .from('brokers')
    .select('id, code, name');

  const brokersMap = new Map<string, { code: 'KITE' | 'SHOONYA'; name: string }>();
  (brokersData || []).forEach((b) => {
    brokersMap.set(b.id, {
      code: (b.code === 'SHOONYA' ? 'SHOONYA' : 'KITE') as 'KITE' | 'SHOONYA',
      name: b.name,
    });
  });

  // 3. Query all candidate trades for this household
  // We fetch trades that were:
  // a) Entered within window
  // b) Closed within window
  // c) Open during window (entered <= windowEnd and (status == OPEN or exit_at >= windowStart))
  let tradesQuery = supabase
    .from('trades')
    .select(`
      *,
      stop_loss_history(*),
      trade_executions(*)
    `)
    .eq('household_id', householdId);

  // Apply portfolio owner filter if specific
  if (filters.portfolio_owner_id && filters.portfolio_owner_id !== 'all') {
    tradesQuery = tradesQuery.eq('portfolio_owner_id', filters.portfolio_owner_id);
  }

  // Apply broker filter if specific
  if (filters.broker && filters.broker !== 'ALL') {
    const targetBroker = (brokersData || []).find((b) =>
      filters.broker === 'ZERODHA'
        ? b.code === 'KITE' || b.name.toLowerCase().includes('zerodha')
        : b.code === filters.broker
    );
    if (targetBroker) {
      tradesQuery = tradesQuery.eq('broker_id', targetBroker.id);
    }
  }

  const { data: rawTrades, error: tradesError } = await tradesQuery;

  if (tradesError) {
    throw new Error(`Failed to query trades for weekly report: ${tradesError.message}`);
  }

  const allTrades: any[] = (rawTrades as any[]) || [];

  // Filter trades relevant to this weekly window according to documented inclusion policy:
  // 1. Opened this week: entry_at in [windowStart, windowEnd]
  // 2. Closed this week: exit_at in [windowStart, windowEnd]
  // 3. Partial exits this week: has trade_executions with executed_at in [windowStart, windowEnd]
  // 4. Open positions carried forward: entry_at <= windowEnd and status == 'OPEN'
  // 5. Stop-loss updates this week: has stop_loss_history with created_at in [windowStart, windowEnd]
  const relevantTrades = allTrades.filter((t) => {
    const entryMs = new Date(t.entry_at).getTime();
    const exitMs = t.exit_at ? new Date(t.exit_at).getTime() : null;

    const openedThisWeek = entryMs >= windowStartMs && entryMs <= windowEndMs;
    const closedThisWeek = exitMs !== null && exitMs >= windowStartMs && exitMs <= windowEndMs;
    const openDuringWeek = entryMs <= windowEndMs && (t.status === 'OPEN' || (exitMs !== null && exitMs >= windowStartMs));

    const slUpdatesThisWeek = (t.stop_loss_history || []).some((sl: any) => {
      const slMs = new Date(sl.created_at).getTime();
      return slMs >= windowStartMs && slMs <= windowEndMs;
    });

    const executionsThisWeek = (t.trade_executions || []).some((ex: any) => {
      const exMs = new Date(ex.executed_at).getTime();
      return exMs >= windowStartMs && exMs <= windowEndMs;
    });

    return openedThisWeek || closedThisWeek || openDuringWeek || slUpdatesThisWeek || executionsThisWeek;
  });

  // Map trades to standardized ReportTradeItem
  const mappedTrades: ReportTradeItem[] = relevantTrades.map((t) => {
    const person = personsMap.get(t.portfolio_owner_id);
    const broker = brokersMap.get(t.broker_id);
    const brokerCode = broker?.code ?? 'KITE';

    // Executions
    const executions: TradeExecutionItem[] = (t.trade_executions || []).map((ex: any) => ({
      id: ex.id,
      execution_type: ex.execution_type,
      quantity: ex.quantity,
      price: Number(ex.price),
      executed_at: ex.executed_at,
      broker_order_id: ex.broker_order_id ?? null,
      charges: ex.charges ?? null,
    }));

    // Stop-loss history
    const slHistory: StopLossHistoryItem[] = (t.stop_loss_history || []).map((sl: any) => {
      const prevStop = sl.previous_stop !== null ? Number(sl.previous_stop) : null;
      const newStop = Number(sl.new_stop);
      const isBreakeven = newStop === Number(t.entry_price);
      const initialRiskPerShare = Math.abs(Number(t.entry_price) - Number(t.initial_stop_loss));

      let levelLabel = 'MANUAL';
      if (sl.stop_type === 'INITIAL') {
        levelLabel = 'INITIAL';
      } else if (sl.stop_type === 'BREAKEVEN' || isBreakeven) {
        levelLabel = 'BREAKEVEN';
      } else if (initialRiskPerShare > 0) {
        const gainPerShare =
          t.direction === 'LONG'
            ? newStop - Number(t.entry_price)
            : Number(t.entry_price) - newStop;
        const rRatio = Math.round((gainPerShare / initialRiskPerShare) * 10) / 10;
        if (Math.abs(rRatio - 1.0) < 0.15) {
          levelLabel = '+1R';
        } else if (Math.abs(rRatio - 2.0) < 0.15) {
          levelLabel = '+2R';
        } else if (Math.abs(rRatio - 3.0) < 0.15) {
          levelLabel = '+3R';
        } else if (rRatio > 0) {
          levelLabel = `+${rRatio}R`;
        } else if (sl.stop_type === 'TRAIL') {
          levelLabel = 'TRAIL';
        }
      } else if (sl.stop_type === 'TRAIL') {
        levelLabel = 'TRAIL';
      }

      // Estimated protected profit at stop
      let estimatedProfitProtected: number | null = null;
      if (t.direction === 'LONG' && newStop > Number(t.entry_price)) {
        estimatedProfitProtected = Math.round((newStop - Number(t.entry_price)) * t.quantity * 100) / 100;
      } else if (t.direction === 'SHORT' && newStop < Number(t.entry_price)) {
        estimatedProfitProtected = Math.round((Number(t.entry_price) - newStop) * t.quantity * 100) / 100;
      } else if (isBreakeven) {
        estimatedProfitProtected = 0;
      }

      return {
        id: sl.id,
        previous_stop: prevStop,
        new_stop: newStop,
        stop_type: sl.stop_type,
        sl_level_label: levelLabel,
        market_price_at_update: sl.market_price_at_update !== null ? Number(sl.market_price_at_update) : null,
        r_multiple_at_update: sl.floating_r_at_update !== null ? Number(sl.floating_r_at_update) : null,
        estimated_profit_protected: estimatedProfitProtected,
        remaining_quantity: t.quantity,
        notes: sl.notes ?? null,
        created_at: sl.created_at,
        is_broker_confirmed: false, // strictly documented: recorded management decision unless confirmed
      };
    });

    // Determine current estimated protected profit for open positions
    let currentProtectedProfit: number | null = null;
    const currentStop = t.current_stop_loss !== null ? Number(t.current_stop_loss) : Number(t.initial_stop_loss);
    if (t.status === 'OPEN' && currentStop > 0) {
      if (t.direction === 'LONG' && currentStop > Number(t.entry_price)) {
        currentProtectedProfit = Math.round((currentStop - Number(t.entry_price)) * t.quantity * 100) / 100;
      } else if (t.direction === 'SHORT' && currentStop < Number(t.entry_price)) {
        currentProtectedProfit = Math.round((Number(t.entry_price) - currentStop) * t.quantity * 100) / 100;
      } else if (currentStop === Number(t.entry_price)) {
        currentProtectedProfit = 0;
      }
    }

    // Determine Swing vs Intraday vs Delivery
    const isSwingStrategy =
      t.strategy_name?.toLowerCase().includes('swing') ||
      t.notes?.toLowerCase().includes('swing');
    const displayTradeType: 'INTRADAY' | 'DELIVERY' | 'SWING' =
      t.trade_type === 'INTRADAY' ? 'INTRADAY' : isSwingStrategy ? 'SWING' : 'DELIVERY';

    return {
      trade_id: t.id,
      symbol: t.symbol,
      portfolio_owner: person?.displayName ?? 'Unknown',
      portfolio_owner_id: t.portfolio_owner_id,
      broker: broker?.name ?? (brokerCode === 'KITE' ? 'Zerodha Kite' : 'Shoonya by Finvasia'),
      broker_code: brokerCode,
      exchange: t.exchange as 'NSE' | 'BSE',
      trade_type: displayTradeType,
      db_trade_type: t.trade_type as 'INTRADAY' | 'DELIVERY',
      direction: t.direction as 'LONG' | 'SHORT',
      entry_at: t.entry_at,
      entry_price: Number(t.entry_price),
      initial_stop_loss: Number(t.initial_stop_loss ?? t.entry_price),
      current_stop_loss: Number(t.current_stop_loss ?? t.initial_stop_loss ?? t.entry_price),
      target_price: t.planned_target !== null ? Number(t.planned_target) : null,
      quantity_entered: t.quantity,
      quantity_exited: t.status === 'CLOSED' ? t.quantity : 0,
      remaining_quantity: t.status === 'OPEN' ? t.quantity : 0,
      exit_price: t.exit_price !== null ? Number(t.exit_price) : null,
      exit_at: t.exit_at ?? null,
      gross_realized_pnl: t.gross_pnl !== null ? Number(t.gross_pnl) : null,
      total_charges: Number(t.total_charges ?? 0),
      net_realized_pnl: t.net_pnl !== null ? Number(t.net_pnl) : null,
      initial_risk_per_share: t.initial_risk_per_share !== null ? Number(t.initial_risk_per_share) : null,
      initial_total_risk: t.initial_risk_rupees !== null ? Number(t.initial_risk_rupees) : null,
      realized_r_multiple: t.realized_r_multiple !== null ? Number(t.realized_r_multiple) : null,
      current_unrealized_pnl: null, // never fabricate market prices
      estimated_protected_profit: currentProtectedProfit,
      status: t.status as 'OPEN' | 'CLOSED',
      strategy: t.strategy_name ?? null,
      entry_rationale: t.notes ?? null,
      notes: t.notes ?? null,
      executions,
      stop_loss_history: slHistory,
    };
  });

  // Filter by requested strategy if specific
  let filteredMappedTrades = mappedTrades;
  if (filters.strategy === 'INTRADAY') {
    filteredMappedTrades = mappedTrades.filter((t) => t.db_trade_type === 'INTRADAY');
  } else if (filters.strategy === 'SWING') {
    filteredMappedTrades = mappedTrades.filter((t) => t.db_trade_type === 'DELIVERY' || t.trade_type === 'SWING');
  }

  // Partition trades into Intraday vs Swing (Delivery)
  const intradayTrades =
    filters.strategy === 'SWING'
      ? []
      : filteredMappedTrades.filter((t) => t.db_trade_type === 'INTRADAY');

  const swingTrades =
    filters.strategy === 'INTRADAY'
      ? []
      : filteredMappedTrades.filter((t) => t.db_trade_type === 'DELIVERY' || t.trade_type === 'SWING');

  // Helper to categorize trades into week lifecycle sections
  const categorizeWeeklySection = (tradesList: ReportTradeItem[]) => {
    const newTrades = tradesList.filter((t) => {
      const ms = new Date(t.entry_at).getTime();
      return ms >= windowStartMs && ms <= windowEndMs;
    });

    const closedTrades = tradesList.filter((t) => {
      if (t.status !== 'CLOSED' || !t.exit_at) return false;
      const ms = new Date(t.exit_at).getTime();
      return ms >= windowStartMs && ms <= windowEndMs;
    });

    const openPositions = tradesList.filter((t) => {
      const entryMs = new Date(t.entry_at).getTime();
      return t.status === 'OPEN' && entryMs <= windowEndMs;
    });

    const partialExits = tradesList.filter((t) => {
      return t.executions.some((ex) => {
        if (ex.execution_type !== 'EXIT') return false;
        const ms = new Date(ex.executed_at).getTime();
        return ms >= windowStartMs && ms <= windowEndMs;
      });
    });

    const stopLossUpdates: StopLossHistoryItem[] = [];
    tradesList.forEach((t) => {
      t.stop_loss_history.forEach((sl) => {
        const ms = new Date(sl.created_at).getTime();
        if (ms >= windowStartMs && ms <= windowEndMs) {
          stopLossUpdates.push(sl);
        }
      });
    });

    return {
      newTrades,
      closedTrades,
      openPositions,
      partialExits,
      stopLossUpdates,
    };
  };

  const combinedLifecycle = categorizeWeeklySection(filteredMappedTrades);
  const intradayLifecycle = categorizeWeeklySection(intradayTrades);
  const swingLifecycle = categorizeWeeklySection(swingTrades);

  // 4. Compute Performance Summaries
  const combinedSummary = computePerformanceSummary(
    combinedLifecycle.closedTrades,
    combinedLifecycle.newTrades,
    filteredMappedTrades,
    windowStartMs,
    windowEndMs
  );

  const intradayBaseSummary = computePerformanceSummary(
    intradayLifecycle.closedTrades,
    intradayLifecycle.newTrades,
    intradayTrades,
    windowStartMs,
    windowEndMs
  );

  const swingBaseSummary = computePerformanceSummary(
    swingLifecycle.closedTrades,
    swingLifecycle.newTrades,
    swingTrades,
    windowStartMs,
    windowEndMs
  );

  // Strategy specific metrics
  const intradaySpecific = computeIntradaySpecific(intradayLifecycle.closedTrades, intradayTrades);
  const swingSpecific = computeSwingSpecific(swingLifecycle.closedTrades, swingLifecycle.openPositions, swingLifecycle.stopLossUpdates);

  // 5. Portfolio Risk Section
  let totalOpenRisk = 0;
  let totalCapitalDeployed = 0;
  let totalProtectedProfit = 0;

  combinedLifecycle.openPositions.forEach((pos) => {
    if (pos.initial_total_risk) totalOpenRisk += pos.initial_total_risk;
    totalCapitalDeployed += pos.entry_price * pos.quantity_entered;
    if (pos.estimated_protected_profit && pos.estimated_protected_profit > 0) {
      totalProtectedProfit += pos.estimated_protected_profit;
    }
  });

  const portfolioRisk: PortfolioRiskSummary = {
    current_open_risk_rupees: Math.round(totalOpenRisk * 100) / 100,
    current_capital_deployed: Math.round(totalCapitalDeployed * 100) / 100,
    estimated_stop_protected_profit: Math.round(totalProtectedProfit * 100) / 100,
    active_open_positions_count: combinedLifecycle.openPositions.length,
    risk_to_capital_ratio:
      totalCapitalDeployed > 0
        ? Math.round((totalOpenRisk / totalCapitalDeployed) * 10000) / 10000
        : null,
  };

  // 6. AI Review Metadata
  const aiReview = compileAIReviewMetadata(
    combinedSummary,
    combinedLifecycle.closedTrades,
    filteredMappedTrades,
    combinedLifecycle.stopLossUpdates
  );

  // 7. Data Quality Audit
  const dataQuality = compileDataQualityAudit(filteredMappedTrades);

  return {
    report_version: '1.0',
    report_type: 'WEEKLY_TRADING_REVIEW',
    generated_at: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    period: {
      start_date: startDate,
      end_date: endDate,
    },
    filters: {
      portfolio_owner: filters.portfolio_owner || 'COMBINED',
      portfolio_owner_id: filters.portfolio_owner_id ?? null,
      strategy: filters.strategy,
      broker: filters.broker,
    },
    summary: combinedSummary,
    weekly_activity: {
      new_trades_opened_this_week: combinedLifecycle.newTrades.length,
      trades_closed_this_week: combinedLifecycle.closedTrades.length,
      partial_exits_this_week: combinedLifecycle.partialExits.length,
      open_positions_carried_forward: combinedLifecycle.openPositions.length,
      stop_loss_updates_this_week: combinedLifecycle.stopLossUpdates.length,
    },
    trades: filteredMappedTrades,
    intraday: {
      summary: {
        ...intradayBaseSummary,
        ...intradaySpecific,
      },
      new_trades: intradayLifecycle.newTrades,
      closed_trades: intradayLifecycle.closedTrades,
      partial_exits: intradayLifecycle.partialExits,
      open_positions: intradayLifecycle.openPositions,
      stop_loss_updates: intradayLifecycle.stopLossUpdates,
    },
    swing: {
      summary: {
        ...swingBaseSummary,
        ...swingSpecific,
      },
      new_trades: swingLifecycle.newTrades,
      closed_trades: swingLifecycle.closedTrades,
      partial_exits: swingLifecycle.partialExits,
      open_positions: swingLifecycle.openPositions,
      stop_loss_updates: swingLifecycle.stopLossUpdates,
    },
    portfolio_risk: portfolioRisk,
    ai_review: aiReview,
    data_quality: dataQuality,
  };
}

/**
 * Computes standard performance summary for a given list of closed trades.
 */
function computePerformanceSummary(
  closedTrades: ReportTradeItem[],
  newTrades: ReportTradeItem[],
  allRelevantTrades: ReportTradeItem[],
  windowStartMs: number,
  windowEndMs: number
): WeeklyPerformanceSummary {
  const totalTrades = closedTrades.length;

  let winningTrades = 0;
  let losingTrades = 0;
  let breakevenTrades = 0;
  let grossRealizedPnl = 0;
  let totalCharges = 0;
  let netRealizedPnl = 0;
  let totalWinPnl = 0;
  let totalLossPnl = 0;
  let totalGrossWins = 0;
  let totalGrossLosses = 0;

  let largestWinner: ExtremeTradeItem | null = null;
  let largestLoser: ExtremeTradeItem | null = null;

  const rMultiples: number[] = [];
  const winningRs: number[] = [];
  const losingRs: number[] = [];

  // Group by direction
  const longTrades: ReportTradeItem[] = [];
  const shortTrades: ReportTradeItem[] = [];

  // Group by broker
  const brokerMap = new Map<'KITE' | 'SHOONYA', ReportTradeItem[]>();

  closedTrades.forEach((t) => {
    const net = t.net_realized_pnl ?? 0;
    const gross = t.gross_realized_pnl ?? 0;
    grossRealizedPnl += gross;
    totalCharges += t.total_charges;
    netRealizedPnl += net;

    if (t.direction === 'LONG') longTrades.push(t);
    else shortTrades.push(t);

    const bList = brokerMap.get(t.broker_code) || [];
    bList.push(t);
    brokerMap.set(t.broker_code, bList);

    if (net > 0) {
      winningTrades++;
      totalWinPnl += net;
      totalGrossWins += gross;
      if (!largestWinner || net > largestWinner.net_pnl) {
        largestWinner = {
          trade_id: t.trade_id,
          symbol: t.symbol,
          net_pnl: net,
          realized_r: t.realized_r_multiple,
          direction: t.direction,
          entry_price: t.entry_price,
          exit_price: t.exit_price,
        };
      }
    } else if (net < 0) {
      losingTrades++;
      totalLossPnl += net;
      totalGrossLosses += Math.abs(gross);
      if (!largestLoser || net < largestLoser.net_pnl) {
        largestLoser = {
          trade_id: t.trade_id,
          symbol: t.symbol,
          net_pnl: net,
          realized_r: t.realized_r_multiple,
          direction: t.direction,
          entry_price: t.entry_price,
          exit_price: t.exit_price,
        };
      }
    } else {
      breakevenTrades++;
    }

    if (t.realized_r_multiple !== null) {
      rMultiples.push(t.realized_r_multiple);
      if (net > 0) winningRs.push(t.realized_r_multiple);
      else if (net < 0) losingRs.push(t.realized_r_multiple);
    }
  });

  const winRate = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 1000) / 10 : null;
  const avgProfit = winningTrades > 0 ? Math.round((totalWinPnl / winningTrades) * 100) / 100 : null;
  const avgLoss = losingTrades > 0 ? Math.round((totalLossPnl / losingTrades) * 100) / 100 : null;

  // R multiples averages
  const avgR = rMultiples.length > 0 ? Math.round((rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length) * 100) / 100 : null;
  const avgWinR = winningRs.length > 0 ? Math.round((winningRs.reduce((a, b) => a + b, 0) / winningRs.length) * 100) / 100 : null;
  const avgLossR = losingRs.length > 0 ? Math.round((losingRs.reduce((a, b) => a + b, 0) / losingRs.length) * 100) / 100 : null;

  // Profit Factor
  let profitFactor: number | null = null;
  if (totalGrossLosses > 0) {
    profitFactor = Math.round((totalGrossWins / totalGrossLosses) * 100) / 100;
  } else if (totalGrossWins > 0) {
    profitFactor = null; // No losses
  }

  // Expectancy
  const expectancy = totalTrades > 0 ? Math.round((netRealizedPnl / totalTrades) * 100) / 100 : null;
  let rExpectancy: number | null = null;
  if (winRate !== null && avgWinR !== null && avgLossR !== null) {
    const wRate = winRate / 100;
    const lRate = 1 - wRate;
    rExpectancy = Math.round((wRate * avgWinR - lRate * Math.abs(avgLossR)) * 100) / 100;
  }

  // Streaks (chronological by exit_at)
  const sortedByExit = [...closedTrades].sort(
    (a, b) => new Date(a.exit_at!).getTime() - new Date(b.exit_at!).getTime()
  );

  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  sortedByExit.forEach((t) => {
    const net = t.net_realized_pnl ?? 0;
    if (net > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (net < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }
  });

  // Risk of new trades
  let totalInitialRisk = 0;
  newTrades.forEach((t) => {
    if (t.initial_total_risk) totalInitialRisk += t.initial_total_risk;
  });
  const avgRiskPerTrade = newTrades.length > 0 ? Math.round((totalInitialRisk / newTrades.length) * 100) / 100 : null;

  // Trading days (distinct calendar days with activity in IST)
  const activityDays = new Set<string>();
  allRelevantTrades.forEach((t) => {
    const entryDate = toISTDateString(t.entry_at);
    activityDays.add(entryDate);
    if (t.exit_at) {
      activityDays.add(toISTDateString(t.exit_at));
    }
  });

  const tradingDays = activityDays.size;
  const tradesPerDay = tradingDays > 0 && totalTrades > 0 ? Math.round((totalTrades / tradingDays) * 10) / 10 : null;

  // Average holding period
  let totalHoldingMs = 0;
  let holdingCount = 0;
  closedTrades.forEach((t) => {
    if (t.exit_at) {
      const dur = new Date(t.exit_at).getTime() - new Date(t.entry_at).getTime();
      if (dur > 0) {
        totalHoldingMs += dur;
        holdingCount++;
      }
    }
  });

  let averageHoldingPeriod: string | null = null;
  if (holdingCount > 0) {
    const avgMs = totalHoldingMs / holdingCount;
    const hours = Math.floor(avgMs / 3600000);
    const minutes = Math.floor((avgMs % 3600000) / 60000);
    if (hours >= 24) {
      const days = (avgMs / 86400000).toFixed(1);
      averageHoldingPeriod = `${days} days`;
    } else {
      averageHoldingPeriod = `${hours}h ${minutes}m`;
    }
  }

  // Long vs Short calculations
  const computeDirectional = (trades: ReportTradeItem[]): DirectionalBreakdown => {
    const cnt = trades.length;
    let w = 0;
    let l = 0;
    let be = 0;
    let gross = 0;
    let chg = 0;
    let net = 0;
    const rList: number[] = [];

    trades.forEach((t) => {
      const n = t.net_realized_pnl ?? 0;
      gross += t.gross_realized_pnl ?? 0;
      chg += t.total_charges;
      net += n;
      if (n > 0) w++;
      else if (n < 0) l++;
      else be++;
      if (t.realized_r_multiple !== null) rList.push(t.realized_r_multiple);
    });

    return {
      trades: cnt,
      wins: w,
      losses: l,
      breakeven: be,
      win_rate: cnt > 0 ? Math.round((w / cnt) * 1000) / 10 : null,
      gross_pnl: Math.round(gross * 100) / 100,
      total_charges: Math.round(chg * 100) / 100,
      net_pnl: Math.round(net * 100) / 100,
      avg_r_multiple: rList.length > 0 ? Math.round((rList.reduce((a, b) => a + b, 0) / rList.length) * 100) / 100 : null,
    };
  };

  // Broker performance
  const brokerPerformance: BrokerPerformanceItem[] = [];
  ['KITE' as const, 'SHOONYA' as const].forEach((code) => {
    const bTrades = brokerMap.get(code) || [];
    const dir = computeDirectional(bTrades);
    brokerPerformance.push({
      broker_code: code,
      broker_name: code === 'KITE' ? 'Zerodha Kite' : 'Shoonya by Finvasia',
      trades: dir.trades,
      wins: dir.wins,
      losses: dir.losses,
      win_rate: dir.win_rate,
      gross_pnl: dir.gross_pnl,
      total_charges: dir.total_charges,
      net_pnl: dir.net_pnl,
      avg_r_multiple: dir.avg_r_multiple,
    });
  });

  return {
    total_trades: totalTrades,
    winning_trades: winningTrades,
    losing_trades: losingTrades,
    breakeven_trades: breakevenTrades,
    win_rate: winRate,
    gross_realized_pnl: Math.round(grossRealizedPnl * 100) / 100,
    total_charges: Math.round(totalCharges * 100) / 100,
    net_realized_pnl: Math.round(netRealizedPnl * 100) / 100,
    average_profit_per_trade: avgProfit,
    average_loss_per_trade: avgLoss,
    largest_winner: largestWinner,
    largest_loser: largestLoser,
    average_realized_r_multiple: avgR,
    average_winning_r: avgWinR,
    average_losing_r: avgLossR,
    profit_factor: profitFactor,
    expectancy,
    r_expectancy: rExpectancy,
    max_consecutive_wins: maxWinStreak,
    max_consecutive_losses: maxLossStreak,
    total_initial_risk: Math.round(totalInitialRisk * 100) / 100,
    average_risk_per_trade: avgRiskPerTrade,
    trading_days: tradingDays,
    trades_per_day: tradesPerDay,
    average_holding_period: averageHoldingPeriod,
    long_vs_short: {
      long: computeDirectional(longTrades),
      short: computeDirectional(shortTrades),
    },
    broker_performance: brokerPerformance,
  };
}

/**
 * Computes Intraday-specific analysis metrics.
 */
function computeIntradaySpecific(
  closedIntradayTrades: ReportTradeItem[],
  allIntradayTrades: ReportTradeItem[]
): IntradaySpecificAnalysis {
  let totalMinutes = 0;
  let closedWithDurationCount = 0;

  // Time of day buckets in IST
  const buckets = {
    morning: { count: 0, net: 0, wins: 0 },
    afternoon: { count: 0, net: 0, wins: 0 },
    closing: { count: 0, net: 0, wins: 0 },
  };

  closedIntradayTrades.forEach((t) => {
    if (t.exit_at) {
      const ms = new Date(t.exit_at).getTime() - new Date(t.entry_at).getTime();
      if (ms > 0) {
        totalMinutes += ms / 60000;
        closedWithDurationCount++;
      }
    }

    // Parse entry hour/minute in IST
    const entryDate = new Date(t.entry_at);
    const istTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(entryDate);

    const [h, m] = istTimeStr.split(':').map(Number);
    const totalMinutesOfDay = (h || 0) * 60 + (m || 0);

    const net = t.net_realized_pnl ?? 0;
    const isWin = net > 0;

    // Morning: 09:15 to 11:30 (555 to 690)
    // Afternoon: 11:30 to 13:30 (690 to 810)
    // Closing: 13:30 to 15:30 (810 to 930)
    if (totalMinutesOfDay < 690) {
      buckets.morning.count++;
      buckets.morning.net += net;
      if (isWin) buckets.morning.wins++;
    } else if (totalMinutesOfDay < 810) {
      buckets.afternoon.count++;
      buckets.afternoon.net += net;
      if (isWin) buckets.afternoon.wins++;
    } else {
      buckets.closing.count++;
      buckets.closing.net += net;
      if (isWin) buckets.closing.wins++;
    }
  });

  const avgHoldingMinutes =
    closedWithDurationCount > 0
      ? Math.round(totalMinutes / closedWithDurationCount)
      : null;

  // Repeated symbols
  const symbolMap = new Map<string, { count: number; gross: number; net: number; wins: number }>();
  allIntradayTrades.forEach((t) => {
    const cur = symbolMap.get(t.symbol) || { count: 0, gross: 0, net: 0, wins: 0 };
    cur.count++;
    if (t.gross_realized_pnl) cur.gross += t.gross_realized_pnl;
    if (t.net_realized_pnl) cur.net += t.net_realized_pnl;
    if ((t.net_realized_pnl ?? 0) > 0) cur.wins++;
    symbolMap.set(t.symbol, cur);
  });

  const repeatedSymbols: RepeatedSymbolItem[] = [];
  symbolMap.forEach((val, sym) => {
    if (val.count >= 2) {
      repeatedSymbols.push({
        symbol: sym,
        count: val.count,
        gross_pnl: Math.round(val.gross * 100) / 100,
        net_pnl: Math.round(val.net * 100) / 100,
        win_rate: val.count > 0 ? Math.round((val.wins / val.count) * 1000) / 10 : null,
      });
    }
  });

  return {
    average_holding_minutes: avgHoldingMinutes,
    time_of_day_performance: [
      {
        period: 'morning',
        label: '09:15 - 11:30 (Morning Session)',
        trades: buckets.morning.count,
        net_pnl: Math.round(buckets.morning.net * 100) / 100,
        win_rate: buckets.morning.count > 0 ? Math.round((buckets.morning.wins / buckets.morning.count) * 1000) / 10 : null,
      },
      {
        period: 'afternoon',
        label: '11:30 - 13:30 (Midday Session)',
        trades: buckets.afternoon.count,
        net_pnl: Math.round(buckets.afternoon.net * 100) / 100,
        win_rate: buckets.afternoon.count > 0 ? Math.round((buckets.afternoon.wins / buckets.afternoon.count) * 1000) / 10 : null,
      },
      {
        period: 'closing',
        label: '13:30 - 15:30 (Closing Session)',
        trades: buckets.closing.count,
        net_pnl: Math.round(buckets.closing.net * 100) / 100,
        win_rate: buckets.closing.count > 0 ? Math.round((buckets.closing.wins / buckets.closing.count) * 1000) / 10 : null,
      },
    ],
    repeated_symbols: repeatedSymbols,
  };
}

/**
 * Computes Swing-specific analysis metrics.
 */
function computeSwingSpecific(
  closedSwingTrades: ReportTradeItem[],
  openSwingPositions: ReportTradeItem[],
  swingStopUpdates: StopLossHistoryItem[]
): SwingSpecificAnalysis {
  let totalDays = 0;
  let closedCount = 0;
  let r1Reached = 0;
  let r2Reached = 0;
  let r3Reached = 0;
  let stoppedAtBeOrProfit = 0;

  // R Distribution buckets
  const rBuckets: RDistributionBucket[] = [
    { range: '< -1R', min: -Infinity, max: -1, count: 0 },
    { range: '-1R to 0R', min: -1, max: 0, count: 0 },
    { range: '0R to +1R', min: 0, max: 1, count: 0 },
    { range: '+1R to +2R', min: 1, max: 2, count: 0 },
    { range: '+2R to +3R', min: 2, max: 3, count: 0 },
    { range: '> +3R', min: 3, max: Infinity, count: 0 },
  ];

  closedSwingTrades.forEach((t) => {
    if (t.exit_at) {
      const ms = new Date(t.exit_at).getTime() - new Date(t.entry_at).getTime();
      if (ms > 0) {
        totalDays += ms / 86400000;
        closedCount++;
      }
    }

    if (t.realized_r_multiple !== null) {
      const r = t.realized_r_multiple;
      if (r >= 1.0) r1Reached++;
      if (r >= 2.0) r2Reached++;
      if (r >= 3.0) r3Reached++;

      for (const b of rBuckets) {
        if (r > b.min && r <= b.max) {
          b.count++;
          break;
        }
      }
    }

    if ((t.net_realized_pnl ?? 0) >= 0) {
      stoppedAtBeOrProfit++;
    }
  });

  const avgHoldingDays = closedCount > 0 ? Math.round((totalDays / closedCount) * 10) / 10 : null;

  // Open risk and protected profit
  let currentOpenRisk = 0;
  let estimatedProtectedProfit = 0;

  openSwingPositions.forEach((pos) => {
    if (pos.initial_total_risk) currentOpenRisk += pos.initial_total_risk;
    if (pos.estimated_protected_profit && pos.estimated_protected_profit > 0) {
      estimatedProtectedProfit += pos.estimated_protected_profit;
    }
  });

  // Stop loss management effectiveness
  let trailedIntoProfit = 0;
  let movedToBreakeven = 0;

  swingStopUpdates.forEach((sl) => {
    if (sl.sl_level_label === 'BREAKEVEN') movedToBreakeven++;
    if (sl.estimated_profit_protected && sl.estimated_profit_protected > 0) trailedIntoProfit++;
  });

  return {
    average_holding_days: avgHoldingDays,
    r_distribution: rBuckets,
    trades_reaching_r_targets: {
      r1_reached: r1Reached,
      r2_reached: r2Reached,
      r3_reached: r3Reached,
    },
    trades_stopped_at_breakeven_or_profit: stoppedAtBeOrProfit,
    current_open_risk: Math.round(currentOpenRisk * 100) / 100,
    estimated_protected_profit: Math.round(estimatedProtectedProfit * 100) / 100,
    stop_loss_management_effectiveness: {
      total_stop_updates: swingStopUpdates.length,
      trailed_into_profit: trailedIntoProfit,
      moved_to_breakeven: movedToBreakeven,
    },
  };
}

/**
 * Factual AI Review Metadata Compilation (Section 7).
 */
function compileAIReviewMetadata(
  summary: WeeklyPerformanceSummary,
  closedTrades: ReportTradeItem[],
  allRelevantTrades: ReportTradeItem[],
  stopUpdates: StopLossHistoryItem[]
): AIReviewMetadata {
  // Repeated symbols
  const symMap = new Map<string, { count: number; gross: number; net: number; wins: number }>();
  allRelevantTrades.forEach((t) => {
    const cur = symMap.get(t.symbol) || { count: 0, gross: 0, net: 0, wins: 0 };
    cur.count++;
    if (t.gross_realized_pnl) cur.gross += t.gross_realized_pnl;
    if (t.net_realized_pnl) cur.net += t.net_realized_pnl;
    if ((t.net_realized_pnl ?? 0) > 0) cur.wins++;
    symMap.set(t.symbol, cur);
  });

  const repeatedSymbols: RepeatedSymbolItem[] = [];
  symMap.forEach((val, sym) => {
    if (val.count >= 2) {
      repeatedSymbols.push({
        symbol: sym,
        count: val.count,
        gross_pnl: Math.round(val.gross * 100) / 100,
        net_pnl: Math.round(val.net * 100) / 100,
        win_rate: val.count > 0 ? Math.round((val.wins / val.count) * 1000) / 10 : null,
      });
    }
  });

  // Largest 3 losses
  const largestLosses: ExtremeTradeItem[] = [...closedTrades]
    .filter((t) => (t.net_realized_pnl ?? 0) < 0)
    .sort((a, b) => (a.net_realized_pnl ?? 0) - (b.net_realized_pnl ?? 0))
    .slice(0, 3)
    .map((t) => ({
      trade_id: t.trade_id,
      symbol: t.symbol,
      net_pnl: t.net_realized_pnl!,
      realized_r: t.realized_r_multiple,
      direction: t.direction,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
    }));

  // Trades with negative realized R
  const negativeRTrades: ExtremeTradeItem[] = closedTrades
    .filter((t) => t.realized_r_multiple !== null && t.realized_r_multiple < 0)
    .map((t) => ({
      trade_id: t.trade_id,
      symbol: t.symbol,
      net_pnl: t.net_realized_pnl ?? 0,
      realized_r: t.realized_r_multiple,
      direction: t.direction,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
    }));

  // Trades where risk increased after entry (SL moved away from market)
  const tradesWhereRiskIncreased: {
    trade_id: string;
    symbol: string;
    initial_stop_loss: number;
    adjusted_stop_loss: number;
    reason: string | null;
  }[] = [];

  allRelevantTrades.forEach((t) => {
    t.stop_loss_history.forEach((sl) => {
      if (sl.previous_stop !== null) {
        if (t.direction === 'LONG' && sl.new_stop < sl.previous_stop) {
          tradesWhereRiskIncreased.push({
            trade_id: t.trade_id,
            symbol: t.symbol,
            initial_stop_loss: sl.previous_stop,
            adjusted_stop_loss: sl.new_stop,
            reason: sl.notes,
          });
        } else if (t.direction === 'SHORT' && sl.new_stop > sl.previous_stop) {
          tradesWhereRiskIncreased.push({
            trade_id: t.trade_id,
            symbol: t.symbol,
            initial_stop_loss: sl.previous_stop,
            adjusted_stop_loss: sl.new_stop,
            reason: sl.notes,
          });
        }
      }
    });
  });

  // Missing entry or exit rationales
  const missingRationales: { trade_id: string; symbol: string; entry_at: string }[] = [];
  allRelevantTrades.forEach((t) => {
    if (!t.entry_rationale || !t.entry_rationale.trim()) {
      missingRationales.push({
        trade_id: t.trade_id,
        symbol: t.symbol,
        entry_at: t.entry_at,
      });
    }
  });

  // Incomplete trades
  const incompleteTrades: { trade_id: string; symbol: string; reason: string }[] = [];
  allRelevantTrades.forEach((t) => {
    if (!t.initial_stop_loss || t.initial_stop_loss <= 0) {
      incompleteTrades.push({
        trade_id: t.trade_id,
        symbol: t.symbol,
        reason: 'Missing initial stop-loss value',
      });
    }
    if (t.status === 'CLOSED' && (t.exit_price === null || !t.exit_at)) {
      incompleteTrades.push({
        trade_id: t.trade_id,
        symbol: t.symbol,
        reason: 'Closed trade missing exit price or timestamp',
      });
    }
  });

  const stopLossViolations = tradesWhereRiskIncreased.length;
  const totalChecked = allRelevantTrades.length;

  return {
    weekly_outcomes: {
      headline:
        summary.net_realized_pnl >= 0
          ? `Profitable week: Net P&L ₹${summary.net_realized_pnl.toLocaleString('en-IN')}`
          : `Unprofitable week: Net P&L ₹${summary.net_realized_pnl.toLocaleString('en-IN')}`,
      total_net_pnl: summary.net_realized_pnl,
      win_rate: summary.win_rate,
      r_expectancy: summary.r_expectancy,
      profit_factor: summary.profit_factor,
    },
    repeated_symbols: repeatedSymbols,
    largest_losses: largestLosses,
    trades_with_negative_r: negativeRTrades,
    trades_where_risk_increased: tradesWhereRiskIncreased,
    stop_loss_rule_adherence: {
      total_trades_checked: totalChecked,
      adhered_count: Math.max(0, totalChecked - stopLossViolations),
      violated_count: stopLossViolations,
      notes: stopLossViolations === 0
        ? '100% adherence: Zero trades had stop-loss moved away to increase risk'
        : `${stopLossViolations} trade(s) had stop-loss adjusted adversely away from entry price`,
    },
    missing_rationales: missingRationales,
    incomplete_trades: incompleteTrades,
  };
}

/**
 * Data Quality Audits (Section 8).
 */
function compileDataQualityAudit(tradesList: ReportTradeItem[]): DataQualityAudit {
  const missingFields: { trade_id: string; symbol: string; field: string }[] = [];
  const incompleteTrades: { trade_id: string; symbol: string; issue: string }[] = [];
  const calculationWarnings: string[] = [];

  tradesList.forEach((t) => {
    if (!t.strategy) {
      missingFields.push({ trade_id: t.trade_id, symbol: t.symbol, field: 'strategy' });
    }
    if (!t.target_price) {
      missingFields.push({ trade_id: t.trade_id, symbol: t.symbol, field: 'target_price' });
    }
    if (!t.notes) {
      missingFields.push({ trade_id: t.trade_id, symbol: t.symbol, field: 'notes' });
    }

    if (t.status === 'CLOSED' && t.gross_realized_pnl === null) {
      incompleteTrades.push({
        trade_id: t.trade_id,
        symbol: t.symbol,
        issue: 'Closed trade without calculated gross P&L',
      });
      calculationWarnings.push(`Trade ${t.symbol} (${t.trade_id.slice(0, 8)}) is marked CLOSED but gross P&L is null.`);
    }

    if (t.initial_total_risk === null || t.initial_total_risk <= 0) {
      calculationWarnings.push(`Trade ${t.symbol} (${t.trade_id.slice(0, 8)}) has no initial risk snapshot.`);
    }
  });

  return {
    missing_fields: missingFields,
    incomplete_trades: incompleteTrades,
    calculation_warnings: calculationWarnings,
  };
}
