import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient';
import { getBrokerById } from '@/lib/brokers';
import { measureAsync } from '@/lib/perf';
import type { Trade } from '@/types/app';

export const metadata = {
  title: 'Analytics & Reports',
  description: 'Detailed trading metrics, broker comparison, and segment performance',
};

export default async function AnalyticsPage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext) return null;

  const supabase = await createSupabaseServerClient();

  // Fast flat query without slow PostgREST nested joins
  const tradesData = await measureAsync('AnalyticsPage:fetchTrades', async () => {
    const { data, error } = await supabase
      .from('trades')
      .select(`
        id, household_id, portfolio_owner_id, broker_id, symbol, exchange,
        trade_type, direction, quantity, entry_price, exit_price, entry_at, exit_at,
        gross_pnl, total_charges, net_pnl, calculation_status, status,
        initial_stop_loss, current_stop_loss, initial_risk_rupees, realized_r_multiple
      `)
      .eq('household_id', appContext.householdId)
      .order('entry_at', { ascending: false });

    if (error) {
      console.error('[AnalyticsPage] Error fetching trades:', error.message);
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
      notes: null,
      createdBy: '',
      updatedBy: null,
      createdAt: t.entry_at,
      updatedAt: t.entry_at,
      initialStopLoss: t.initial_stop_loss ? Number(t.initial_stop_loss) : null,
      currentStopLoss: t.current_stop_loss ? Number(t.current_stop_loss) : null,
      initialRiskRupees: t.initial_risk_rupees ? Number(t.initial_risk_rupees) : null,
      realizedRMultiple: t.realized_r_multiple ? Number(t.realized_r_multiple) : null,
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
      <TopBar title="Analytics & Reports" />
      <AnalyticsClient initialTrades={trades} />
    </div>
  );
}
