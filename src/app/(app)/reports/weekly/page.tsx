import React from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { WeeklyReportClient } from '@/components/reports/WeeklyReportClient';

export const metadata = {
  title: 'Weekly Trading Reports',
  description: 'Weekly Intraday and Swing performance reports with standardized JSON export',
};

export default async function WeeklyReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  let userRole = 'VIEWER';
  let householdId = '00000000-0000-0000-0000-000000000001';

  if (user) {
    const { data: member } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (member) {
      householdId = member.household_id;
      userRole = member.role;
      isAdmin = member.role === 'ADMIN';
    }
  }

  // Fetch household persons
  const { data: personsData } = await supabase
    .from('persons')
    .select('id, display_name, relationship_label')
    .eq('household_id', householdId)
    .eq('is_active', true);

  const persons = (personsData || []).map((p) => ({
    id: p.id,
    label: `${p.display_name} (${p.relationship_label || 'Member'})`,
  }));

  // Fetch active brokers
  const { data: brokersData } = await supabase
    .from('brokers')
    .select('code, name')
    .eq('is_active', true);

  const brokers = [
    { code: 'ALL' as const, name: 'All Brokers' },
    { code: 'ZERODHA' as const, name: 'Zerodha Kite' },
    { code: 'SHOONYA' as const, name: 'Shoonya by Finvasia' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Weekly Reports" />
      <WeeklyReportClient
        isAdmin={isAdmin}
        userRole={userRole}
        persons={persons}
        brokers={brokers}
      />
    </div>
  );
}
