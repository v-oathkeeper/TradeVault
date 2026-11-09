import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { TradeHistoryClient } from '@/components/trades/TradeHistoryClient';
import type { Trade } from '@/types/app';

export const metadata = {
  title: 'Trade Journal',
  description: 'Complete log of trading executions and broker fee breakdowns',
};

export default async function TradesPage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext) return null;

  const supabase = await createSupabaseServerClient();

  // Selective projection: only fetch columns needed for table display and filtering
  const { data: tradesData } = await supabase
    .from('trades')
    .select(`
      id, household_id, portfolio_owner_id, broker_id, symbol, exchange,
      trade_type, direction, quantity, entry_price, exit_price, entry_at, exit_at,
      gross_pnl, total_charges, net_pnl, calculation_status, status, notes,
      initial_stop_loss, current_stop_loss, initial_risk_rupees, realized_r_multiple,
      strategy_name,
      portfolio_owner:persons(id, display_name, relationship_label),
      broker:brokers(id, code, name)
    `)
    .eq('household_id', appContext.householdId)
    .order('entry_at', { ascending: false });

  const trades: Trade[] = (tradesData || []).map((t) => ({
    id: t.id,
    householdId: t.household_id,
    portfolioOwnerId: t.portfolio_owner_id,
    brokerId: t.broker_id,
    symbol: t.symbol,
    exchange: t.exchange,
    tradeType: t.trade_type,
    direction: t.direction,
    quantity: t.quantity,
    entryPrice: Number(t.entry_price),
    exitPrice: t.exit_price ? Number(t.exit_price) : null,
    entryAt: t.entry_at,
    exitAt: t.exit_at,
    grossPnl: t.gross_pnl ? Number(t.gross_pnl) : null,
    totalCharges: Number(t.total_charges ?? 0),
    netPnl: t.net_pnl ? Number(t.net_pnl) : null,
    chargesBreakdown: null,
    calculationStatus: t.calculation_status,
    status: t.status,
    notes: t.notes,
    createdBy: '',
    updatedBy: null,
    createdAt: t.entry_at,
    updatedAt: t.entry_at,
    initialStopLoss: t.initial_stop_loss ? Number(t.initial_stop_loss) : null,
    currentStopLoss: t.current_stop_loss ? Number(t.current_stop_loss) : null,
    initialRiskRupees: t.initial_risk_rupees ? Number(t.initial_risk_rupees) : null,
    realizedRMultiple: t.realized_r_multiple ? Number(t.realized_r_multiple) : null,
    strategyName: t.strategy_name ?? null,
    portfolioOwner: t.portfolio_owner,
    broker: t.broker,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Trade Journal" />
      <TradeHistoryClient initialTrades={trades} />
    </div>
  );
}
