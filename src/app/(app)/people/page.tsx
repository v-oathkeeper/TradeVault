import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { PeopleClient } from '@/components/people/PeopleClient';
import type { Trade } from '@/types/app';

export const metadata = {
  title: 'Portfolio Owners',
  description: 'Manage family portfolios and member trading metrics',
};

export default async function PeoplePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let trades: Trade[] = [];

  if (user) {
    const { data: member } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const householdId = member?.household_id ?? '00000000-0000-0000-0000-000000000001';

    const { data: tradesData } = await supabase
      .from('trades')
      .select('*')
      .eq('household_id', householdId);

    if (tradesData) {
      trades = tradesData.map((t) => ({
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
        chargesBreakdown: t.charges_breakdown as any,
        calculationStatus: t.calculation_status,
        status: t.status,
        notes: t.notes,
        createdBy: t.created_by,
        updatedBy: t.updated_by,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Portfolio Owners" />
      <PeopleClient initialTrades={trades} />
    </div>
  );
}
