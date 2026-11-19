import React from 'react';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { getCapitalPageData } from '@/lib/services/capital-service';
import { TopBar } from '@/components/layout/TopBar';
import { CapitalPageClient } from '@/components/capital/CapitalPageClient';

export const metadata = {
  title: 'Capital Management',
  description: 'Manage contributed capital, track profit withdrawals and monitor portfolio equity',
};

export default async function CapitalPage() {
  const appContext = await getHouseholdAppContext();

  const { summary, transactions, total } = await getCapitalPageData(
    appContext.householdId,
    appContext.persons
  );

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Capital Management" />
      <CapitalPageClient
        initialSummary={summary}
        initialTransactions={transactions}
        initialTransactionTotal={total}
        isAdmin={appContext.isAdmin}
      />
    </div>
  );
}
