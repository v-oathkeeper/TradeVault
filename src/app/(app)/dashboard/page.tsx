import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { getHouseholdCapitalSummary } from '@/lib/services/capital-service';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import type { Trade } from '@/types/app';
import type { HouseholdCapitalSummary } from '@/types/capital';

export const metadata = {
  title: 'Dashboard',
  description: 'Family trading journal overview and performance metrics',
};

export default async function DashboardPage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext) return null;

  const supabase = await createSupabaseServerClient();

  // Fetch trades + capital summary in parallel (cached context means no extra auth roundtrip)
  const [tradesResult, capitalSummary] = await Promise.all([
    supabase
      .from('trades')
      .select(`
        id, household_id, portfolio_owner_id, broker_id, symbol, exchange,
        trade_type, direction, quantity, entry_price, exit_price, entry_at, exit_at,
        gross_pnl, total_charges, net_pnl, calculation_status, status,
        initial_stop_loss, current_stop_loss, initial_risk_rupees, realized_r_multiple,
        portfolio_owner:persons(id, display_name, relationship_label),
        broker:brokers(id, code, name)
      `)
      .eq('household_id', appContext.householdId)
      .order('entry_at', { ascending: false }),

    getHouseholdCapitalSummary(appContext.householdId).catch((): HouseholdCapitalSummary => ({
      householdId: appContext.householdId,
      owners: appContext.persons.map((p) => ({
        portfolioOwnerId: p.id,
        displayName: p.displayName,
        relationshipLabel: p.relationshipLabel,
        intraday: {
          portfolioOwnerId: p.id,
          strategyBucket: 'INTRADAY' as const,
          contributedCapital: 0,
          cumulativeNetRealizedPnl: 0,
          cumulativeProfitWithdrawals: 0,
          cumulativeCapitalWithdrawals: 0,
          availableProfitForWithdrawal: 0,
          currentCapital: 0,
          closedTradeCount: 0,
        },
        swing: {
          portfolioOwnerId: p.id,
          strategyBucket: 'SWING' as const,
          contributedCapital: 0,
          cumulativeNetRealizedPnl: 0,
          cumulativeProfitWithdrawals: 0,
          cumulativeCapitalWithdrawals: 0,
          availableProfitForWithdrawal: 0,
          currentCapital: 0,
          closedTradeCount: 0,
        },
        totalContributedCapital: 0,
        totalCurrentCapital: 0,
        totalNetRealizedPnl: 0,
        totalAvailableProfitForWithdrawal: 0,
        totalProfitWithdrawn: 0,
        totalCapitalWithdrawn: 0,
      })),
      combinedContributedCapital: 0,
      combinedCurrentCapital: 0,
      combinedNetRealizedPnl: 0,
      combinedAvailableProfit: 0,
    })),
  ]);

  const { data: tradesData } = tradesResult;

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
    notes: null,
    createdBy: '',
    updatedBy: null,
    createdAt: t.entry_at,
    updatedAt: t.entry_at,
    initialStopLoss: t.initial_stop_loss ? Number(t.initial_stop_loss) : null,
    currentStopLoss: t.current_stop_loss ? Number(t.current_stop_loss) : null,
    initialRiskRupees: t.initial_risk_rupees ? Number(t.initial_risk_rupees) : null,
    realizedRMultiple: t.realized_r_multiple ? Number(t.realized_r_multiple) : null,
    portfolioOwner: t.portfolio_owner,
    broker: t.broker,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Dashboard" />
      <DashboardClient initialTrades={trades} capitalSummary={capitalSummary} isAdmin={appContext.isAdmin} />
    </div>
  );
}
