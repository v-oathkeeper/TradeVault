import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { PeopleClient } from '@/components/people/PeopleClient';

export const metadata = {
  title: 'Portfolio Owners',
  description: 'Manage family portfolios and member trading metrics',
};

export default async function PeoplePage() {
  const appContext = await getHouseholdAppContext();
  const supabase = await createSupabaseServerClient();
  const { data: tradesData, error } = await supabase
    .from('trades')
    .select('portfolio_owner_id, status, net_pnl, total_charges, entry_price, quantity')
    .eq('household_id', appContext.householdId);

  if (error) {
    throw new Error(`Failed to load portfolio trades: ${error.message}`);
  }

  const trades = (tradesData ?? []).map((t) => ({
    portfolioOwnerId: t.portfolio_owner_id,
    status: t.status,
    netPnl: t.net_pnl != null ? Number(t.net_pnl) : null,
    totalCharges: Number(t.total_charges ?? 0),
    entryPrice: Number(t.entry_price),
    quantity: t.quantity,
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Portfolio Owners" />
      <PeopleClient initialTrades={trades} />
    </div>
  );
}
