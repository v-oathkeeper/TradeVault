import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { TradeForm } from '@/components/trades/TradeForm';

export const metadata = {
  title: 'Record Trade',
  description: 'Record a new trade execution',
};

export default async function NewTradePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check admin role
  const { data: member } = await supabase
    .from('household_members')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (member?.role === 'VIEWER') {
    redirect('/trades');
  }

  // Fetch active brokers
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
      : [
          {
            id: 'a1000000-0000-0000-0000-000000000001',
            code: 'KITE' as const,
            name: 'Zerodha Kite',
          },
          {
            id: 'a2000000-0000-0000-0000-000000000002',
            code: 'SHOONYA' as const,
            name: 'Shoonya by Finvasia',
          },
        ];

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="New Trade" />
      <TradeForm brokers={brokers} />
    </div>
  );
}
