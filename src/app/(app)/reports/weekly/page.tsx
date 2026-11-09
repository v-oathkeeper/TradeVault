import React from 'react';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { WeeklyReportClient } from '@/components/reports/WeeklyReportClient';

export const metadata = {
  title: 'Weekly Trading Reports',
  description: 'Weekly Intraday and Swing performance reports with standardized JSON export',
};

export default async function WeeklyReportsPage() {
  const appContext = await getHouseholdAppContext();

  const isAdmin = appContext?.isAdmin ?? false;
  const userRole = appContext?.role ?? 'VIEWER';

  const persons = (appContext?.persons || []).map((p) => ({
    id: p.id,
    label: `${p.displayName} (${p.relationshipLabel || 'Member'})`,
  }));

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
