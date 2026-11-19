import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { TradeForm } from '@/components/trades/TradeForm';

export const metadata = {
  title: 'Record Trade',
  description: 'Record a new trade execution',
};

export default async function NewTradePage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext.isAdmin) redirect('/trades');

  const supabase = await createSupabaseServerClient();

  // Fetch active brokers
  const { data: brokersData, error } = await supabase
    .from('brokers')
    .select('id, code, name')
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to load brokers: ${error.message}`);
  }

  const brokers = (brokersData ?? []).map((b) => ({
          id: b.id,
          code: b.code as 'KITE' | 'SHOONYA',
          name: b.name,
        }));

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="New Trade" />
      <TradeForm brokers={brokers} />
    </div>
  );
}
