import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { TradeForm } from '@/components/trades/TradeForm';

interface EditTradePageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Edit Trade',
};

export default async function EditTradePage({ params }: EditTradePageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Verify Admin role
  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .single();

  if (member?.role === 'VIEWER') {
    redirect('/trades');
  }

  const { data: trade, error } = await supabase
    .from('trades')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !trade) {
    notFound();
  }

  const { data: brokersData } = await supabase
    .from('brokers')
    .select('id, code, name')
    .eq('is_active', true);

  const brokers =
    brokersData && brokersData.length > 0
      ? brokersData.map((b) => ({
          id: b.id,
          code: b.code as 'KITE' | 'SHOONYA',
          name: b.name,
        }))
      : [];

  const initialData = {
    id: trade.id,
    portfolioOwnerId: trade.portfolio_owner_id,
    brokerId: trade.broker_id,
    tradeType: trade.trade_type,
    direction: trade.direction,
    exchange: trade.exchange,
    symbol: trade.symbol,
    quantity: trade.quantity,
    entryPrice: Number(trade.entry_price),
    exitPrice: trade.exit_price ? Number(trade.exit_price) : null,
    entryAt: trade.entry_at,
    exitAt: trade.exit_at,
    notes: trade.notes,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={`Edit ${trade.symbol}`} />
      <TradeForm brokers={brokers} initialData={initialData} isEditing />
    </div>
  );
}
