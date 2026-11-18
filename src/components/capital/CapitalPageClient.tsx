'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  LayoutGrid,
  Heart,
  Sparkles,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { CapitalCards } from '@/components/capital/CapitalCards';
import { CapitalTransactionHistory } from '@/components/capital/CapitalTransactionHistory';
import { useCapitalData } from '@/lib/hooks/useCapitalData';
import type { HouseholdCapitalSummary, CapitalTransaction } from '@/types/capital';

const AddMoneyModal = dynamic(
  () => import('@/components/capital/AddMoneyModal').then((m) => m.AddMoneyModal),
  { ssr: false }
);

const WithdrawMoneyModal = dynamic(
  () => import('@/components/capital/WithdrawMoneyModal').then((m) => m.WithdrawMoneyModal),
  { ssr: false }
);

const SetInitialCapitalModal = dynamic(
  () => import('@/components/capital/SetInitialCapitalModal').then((m) => m.SetInitialCapitalModal),
  { ssr: false }
);

type Tab = 'overview' | 'history';

interface CapitalPageClientProps {
  initialSummary: HouseholdCapitalSummary;
  initialTransactions: CapitalTransaction[];
  initialTransactionTotal: number;
  isAdmin: boolean;
}

export function CapitalPageClient({
  initialSummary,
  initialTransactions,
  initialTransactionTotal,
  isAdmin,
}: CapitalPageClientProps) {
  const router = useRouter();
  const { summary, invalidateCapitalCache, husbandSummary, wifeSummary } = useCapitalData(initialSummary);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showWithdrawMoney, setShowWithdrawMoney] = useState(false);
  const [showSetInitialCapital, setShowSetInitialCapital] = useState(false);
  const [preselectedOwnerId, setPreselectedOwnerId] = useState<string | undefined>();
  const [defaultWithdrawalType, setDefaultWithdrawalType] = useState<'PROFIT' | 'CAPITAL'>('PROFIT');

  const handleAddMoney = useCallback((ownerId?: string) => {
    setPreselectedOwnerId(ownerId);
    setShowAddMoney(true);
  }, []);

  const handleWithdrawMoney = useCallback((ownerId?: string, type: 'PROFIT' | 'CAPITAL' = 'PROFIT') => {
    setPreselectedOwnerId(ownerId);
    setDefaultWithdrawalType(type);
    setShowWithdrawMoney(true);
  }, []);

  const handleSetInitialCapital = useCallback(() => {
    setShowSetInitialCapital(true);
  }, []);

  const handleSuccess = useCallback(() => {
    invalidateCapitalCache();
    router.refresh();
  }, [invalidateCapitalCache, router]);

  const activeSummary = summary || initialSummary;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-rose-500 font-semibold text-xs tracking-wider uppercase flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-current" />
              Couple's Finance
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Capital &amp; Profit Management
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Manage Husband &amp; Wife capital records, add money, and withdraw profits or capital
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSetInitialCapital}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[var(--card)] hover:bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] font-semibold text-xs transition-colors shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span>Initial Capital</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddMoney()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>Add Money</span>
            </button>
            <button
              type="button"
              onClick={() => handleWithdrawMoney()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>Withdraw Money</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--background)] border border-[var(--border)] w-fit text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'overview'
              ? 'bg-[var(--card)] text-rose-500 font-bold shadow-sm border border-[var(--border)]'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Capital Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'history'
              ? 'bg-[var(--card)] text-rose-500 font-bold shadow-sm border border-[var(--border)]'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Transaction History</span>
          {initialTransactionTotal > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold">
              {initialTransactionTotal}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <CapitalCards
          summary={activeSummary}
          isAdmin={isAdmin}
          onAddMoney={handleAddMoney}
          onWithdrawMoney={handleWithdrawMoney}
          onSetInitialCapital={handleSetInitialCapital}
        />
      )}

      {activeTab === 'history' && (
        <CapitalTransactionHistory
          transactions={initialTransactions}
          total={initialTransactionTotal}
        />
      )}

      {/* Admin Modals */}
      {isAdmin && (
        <>
          <AddMoneyModal
            open={showAddMoney}
            onClose={() => setShowAddMoney(false)}
            onSuccess={handleSuccess}
            preselectedOwnerId={preselectedOwnerId}
          />
          <WithdrawMoneyModal
            open={showWithdrawMoney}
            onClose={() => setShowWithdrawMoney(false)}
            onSuccess={handleSuccess}
            summary={activeSummary}
            preselectedOwnerId={preselectedOwnerId}
            defaultWithdrawalType={defaultWithdrawalType}
          />
          <SetInitialCapitalModal
            open={showSetInitialCapital}
            onClose={() => setShowSetInitialCapital(false)}
            onSuccess={handleSuccess}
            husbandInitial={husbandSummary?.initialCapital ?? 0}
            wifeInitial={wifeSummary?.initialCapital ?? 0}
            husbandId={husbandSummary?.portfolioOwnerId}
            wifeId={wifeSummary?.portfolioOwnerId}
          />
        </>
      )}
    </div>
  );
}
