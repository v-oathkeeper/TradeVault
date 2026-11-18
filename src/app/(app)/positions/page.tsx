import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { PositionsClient } from '@/components/positions/PositionsClient';
import { getBrokerById } from '@/lib/brokers';
import { measureAsync } from '@/lib/perf';
import type { Trade } from '@/types/app';

export const metadata = {
  title: 'Open Positions',
  description: 'Manage active intraday and delivery positions',
};

export default async function PositionsPage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext) return null;

  const supabase = await createSupabaseServerClient();

  // Fast flat query: fetch active OPEN positions with required scalar fields
  const tradesData = await measureAsync('PositionsPage:fetchTrades', async () => {
    const { data, error } = await supabase
      .from('trades')
      .select(`
        id, household_id, portfolio_owner_id, broker_id, symbol, exchange,
        trade_type, direction, quantity, entry_price, exit_price, entry_at, exit_at,
        gross_pnl, total_charges, net_pnl, calculation_status, status, notes,
        initial_stop_loss, current_stop_loss, initial_risk_rupees, initial_risk_per_share,
        planned_target, milestone1_target, milestone1_status, milestone1_trailing_sl,
        milestone2_target, milestone2_status, milestone2_trailing_sl,
        milestone3_target, milestone3_status, milestone3_trailing_sl,
        current_trailing_sl, last_reached_milestone, milestones_updated_at
      `)
      .eq('household_id', appContext.householdId)
      .eq('status', 'OPEN')
      .order('entry_at', { ascending: false });

    if (error) {
      console.error('[PositionsPage] Error fetching positions:', error.message);
      return [];
    }
    return data || [];
  });

  const personMap = new Map(appContext.persons.map((p) => [p.id, p]));

  const trades: Trade[] = tradesData.map((t) => {
    const person = personMap.get(t.portfolio_owner_id);
    const broker = getBrokerById(t.broker_id);

    return {
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
      milestone1_target: t.milestone1_target ? Number(t.milestone1_target) : null,
      milestone1_status: t.milestone1_status ?? null,
      milestone1_trailing_sl: t.milestone1_trailing_sl ? Number(t.milestone1_trailing_sl) : null,
      milestone2_target: t.milestone2_target ? Number(t.milestone2_target) : null,
      milestone2_status: t.milestone2_status ?? null,
      milestone2_trailing_sl: t.milestone2_trailing_sl ? Number(t.milestone2_trailing_sl) : null,
      milestone3_target: t.milestone3_target ? Number(t.milestone3_target) : null,
      milestone3_status: t.milestone3_status ?? null,
      milestone3_trailing_sl: t.milestone3_trailing_sl ? Number(t.milestone3_trailing_sl) : null,
      current_trailing_sl: t.current_trailing_sl ? Number(t.current_trailing_sl) : null,
      last_reached_milestone: t.last_reached_milestone ?? null,
      milestones_updated_at: t.milestones_updated_at ?? null,
      portfolioOwner: person
        ? {
            id: person.id,
            displayName: person.displayName,
            display_name: person.displayName,
            relationshipLabel: person.relationshipLabel,
            relationship_label: person.relationshipLabel,
          }
        : undefined,
      broker: broker
        ? {
            id: broker.id,
            code: broker.code,
            name: broker.name,
          }
        : undefined,
    };
  });

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Open Positions" />
      <PositionsClient initialTrades={trades} />
    </div>
  );
}
