import React from 'react';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { getHouseholdCapitalSummary, getCapitalTransactions } from '@/lib/services/capital-service';
import { TopBar } from '@/components/layout/TopBar';
import { CapitalPageClient } from '@/components/capital/CapitalPageClient';

export const metadata = {
  title: 'Capital Management',
  description: 'Manage contributed capital, track profit withdrawals and monitor portfolio equity',
};

export default async function CapitalPage() {
  const appContext = await getHouseholdAppContext();
  if (!appContext) return null;

  // Fetch capital summary and recent transactions in parallel
  const [summary, transactionsResult] = await Promise.all([
    getHouseholdCapitalSummary(appContext.householdId).catch(() => ({
      householdId: appContext.householdId,
      owners: appContext.persons.map((p) => ({
        portfolioOwnerId: p.id,
        displayName: p.displayName,
        relationshipLabel: p.relationshipLabel,
        intraday: { portfolioOwnerId: p.id, strategyBucket: 'INTRADAY' as const, contributedCapital: 0, cumulativeNetRealizedPnl: 0, cumulativeProfitWithdrawals: 0, cumulativeCapitalWithdrawals: 0, availableProfitForWithdrawal: 0, currentCapital: 0, closedTradeCount: 0 },
        swing: { portfolioOwnerId: p.id, strategyBucket: 'SWING' as const, contributedCapital: 0, cumulativeNetRealizedPnl: 0, cumulativeProfitWithdrawals: 0, cumulativeCapitalWithdrawals: 0, availableProfitForWithdrawal: 0, currentCapital: 0, closedTradeCount: 0 },
        totalContributedCapital: 0, totalCurrentCapital: 0, totalNetRealizedPnl: 0, totalAvailableProfitForWithdrawal: 0, totalProfitWithdrawn: 0, totalCapitalWithdrawn: 0,
      })),
      combinedContributedCapital: 0, combinedCurrentCapital: 0, combinedNetRealizedPnl: 0, combinedAvailableProfit: 0,
    })),
    getCapitalTransactions(appContext.householdId, { limit: 50 }).catch(() => ({ transactions: [], total: 0 })),
  ]);

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Capital Management" />
      <CapitalPageClient
        initialSummary={summary}
        initialTransactions={transactionsResult.transactions}
        initialTransactionTotal={transactionsResult.total}
        isAdmin={appContext.isAdmin}
      />
    </div>
  );
}
