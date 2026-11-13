import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { calculateCapitalSummary } from '@/lib/services/capital-service';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { getBrokerById } from '@/lib/brokers';
import { measureAsync } from '@/lib/perf';
import type { Trade } from '@/types/app';
import type { CapitalTransactionRow } from '@/types/database';

export const metadata = {
  title: 'Dashboard',
  description: 'Family trading journal overview and performance metrics',
};

export default async function DashboardPage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext) return null;

  const supabase = await createSupabaseServerClient();

  // Run independent database fetches in a single parallel roundtrip
  const [tradesResult, txResult] = await measureAsync('DashboardPage:parallelDataFetch', () =>
    Promise.all([
      supabase
        .from('trades')
        .select(`
          id, household_id, portfolio_owner_id, broker_id, symbol, exchange,
          trade_type, direction, quantity, entry_price, exit_price, entry_at, exit_at,
          gross_pnl, total_charges, net_pnl, calculation_status, status,
          initial_stop_loss, current_stop_loss, initial_risk_rupees, realized_r_multiple
        `)
        .eq('household_id', appContext.householdId)
        .order('entry_at', { ascending: false }),

      supabase
        .from('capital_transactions')
        .select('*')
        .eq('household_id', appContext.householdId),
    ])
  );

  const tradesData = tradesResult.data || [];
  const txRows = (txResult.data as CapitalTransactionRow[]) || [];

  // Filter closed trades in-memory for instant capital aggregation
  const closedTrades = tradesData
    .filter((t) => t.status === 'CLOSED')
    .map((t) => ({
      portfolio_owner_id: t.portfolio_owner_id,
      trade_type: t.trade_type,
      net_pnl: t.net_pnl,
    }));

  const capitalSummary = calculateCapitalSummary(
    appContext.householdId,
    appContext.persons,
    closedTrades,
    txRows
  );

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
      <TopBar title="Dashboard" />
      <DashboardClient initialTrades={trades} capitalSummary={capitalSummary} isAdmin={appContext.isAdmin} />
    </div>
  );
}
