'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, ArrowDownCircle, History, LayoutGrid, Scale } from 'lucide-react';
import dynamic from 'next/dynamic';
import { CapitalCards } from '@/components/capital/CapitalCards';
import { CapitalTransactionHistory } from '@/components/capital/CapitalTransactionHistory';
import { ReconciliationView } from '@/components/capital/ReconciliationView';
import type { HouseholdCapitalSummary, CapitalTransaction, OwnerCapitalSummary } from '@/types/capital';

const ManageCapitalModal = dynamic(
  () => import('@/components/capital/ManageCapitalModal').then((m) => m.ManageCapitalModal),
  { ssr: false }
);
const RecordWithdrawalModal = dynamic(
  () => import('@/components/capital/RecordWithdrawalModal').then((m) => m.RecordWithdrawalModal),
  { ssr: false }
);

type Tab = 'overview' | 'history' | 'reconciliation';

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
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showManageModal, setShowManageModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [preselectedOwnerId, setPreselectedOwnerId] = useState<string | undefined>();

  const handleManageCapital = useCallback((ownerId: string) => {
    setPreselectedOwnerId(ownerId);
    setShowManageModal(true);
  }, []);

  const handleRecordWithdrawal = useCallback((ownerId: string) => {
    setPreselectedOwnerId(ownerId);
    setShowWithdrawalModal(true);
  }, []);

  const handleSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Capital &amp; Profit Management
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Track contributed capital, realized P&amp;L, and withdrawals per portfolio owner and strategy
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setPreselectedOwnerId(undefined); setShowManageModal(true); }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--card)] hover:bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] font-semibold text-xs transition-colors shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-blue-500" />
              <span>Manage Capital</span>
            </button>
            <button
              type="button"
              onClick={() => { setPreselectedOwnerId(undefined); setShowWithdrawalModal(true); }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>Record Withdrawal</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--card)] border border-[var(--border)] w-fit">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'overview'
              ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Overview
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'history'
              ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          History
          {initialTransactionTotal > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-500 text-[9px] font-bold">
              {initialTransactionTotal}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'reconciliation'
              ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--foreground)]'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          Reconciliation
        </button>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <CapitalCards
          summary={initialSummary}
          isAdmin={isAdmin}
          onManageCapital={handleManageCapital}
          onRecordWithdrawal={handleRecordWithdrawal}
        />
      )}

      {activeTab === 'history' && (
        <CapitalTransactionHistory
          transactions={initialTransactions}
          total={initialTransactionTotal}
        />
      )}

      {activeTab === 'reconciliation' && (
        <ReconciliationView
          summary={initialSummary}
          transactions={initialTransactions}
        />
      )}

      {/* Modals */}
      {isAdmin && (
        <>
          <ManageCapitalModal
            open={showManageModal}
            owners={initialSummary.owners}
            initialOwnerId={preselectedOwnerId}
            onClose={() => setShowManageModal(false)}
            onSuccess={handleSuccess}
          />
          <RecordWithdrawalModal
            open={showWithdrawalModal}
            owners={initialSummary.owners}
            initialOwnerId={preselectedOwnerId}
            onClose={() => setShowWithdrawalModal(false)}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  );
}
