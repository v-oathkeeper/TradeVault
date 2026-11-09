import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { PositionsClient } from '@/components/positions/PositionsClient';
import type { Trade } from '@/types/app';

export const metadata = {
  title: 'Open Positions',
  description: 'Manage active intraday and delivery positions',
};

export default async function PositionsPage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext) return null;

  const supabase = await createSupabaseServerClient();

  // Selective projection: only fetch active OPEN positions with required fields
  const { data: tradesData } = await supabase
    .from('trades')
    .select(`
      id, household_id, portfolio_owner_id, broker_id, symbol, exchange,
      trade_type, direction, quantity, entry_price, exit_price, entry_at, exit_at,
      gross_pnl, total_charges, net_pnl, calculation_status, status, notes,
      initial_stop_loss, current_stop_loss, initial_risk_rupees, initial_risk_per_share,
      planned_target, planned_rr, r1_price, r2_price, r3_price,
      portfolio_owner:persons(id, display_name, relationship_label),
      broker:brokers(id, code, name)
    `)
    .eq('household_id', appContext.householdId)
    .eq('status', 'OPEN')
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
    initialRiskPerShare: t.initial_risk_per_share ? Number(t.initial_risk_per_share) : null,
    plannedTarget: t.planned_target ? Number(t.planned_target) : null,
    plannedRR: t.planned_rr ? Number(t.planned_rr) : null,
    r1Price: t.r1_price ? Number(t.r1_price) : null,
    r2Price: t.r2_price ? Number(t.r2_price) : null,
    r3Price: t.r3_price ? Number(t.r3_price) : null,
    portfolioOwner: t.portfolio_owner,
    broker: t.broker,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Open Positions" />
      <PositionsClient initialTrades={trades} />
    </div>
  );
}
