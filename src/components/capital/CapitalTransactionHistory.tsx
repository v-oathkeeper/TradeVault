'use client';

import React from 'react';
import { formatINR } from '@/lib/utils';
import type { CapitalTransaction } from '@/types/capital';
import { useUser } from '@/components/providers/UserContext';
import { Calendar, User, Tag, FileText } from 'lucide-react';

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  INITIAL_ALLOCATION:   { label: 'Initial Capital',        color: 'text-rose-500 bg-rose-500/10 border-rose-500/20'    },
  CAPITAL_CONTRIBUTION: { label: 'Add Money',              color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  CAPITAL_ADJUSTMENT:   { label: 'Capital Adjustment',    color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  CAPITAL_WITHDRAWAL:   { label: 'Withdraw Invested Capital', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  PROFIT_WITHDRAWAL:    { label: 'Withdraw Profit',         color: 'text-orange-500 bg-orange-500/10 border-orange-500/20'   },
};

interface CapitalTransactionHistoryProps {
  transactions: CapitalTransaction[];
  total: number;
}

export function CapitalTransactionHistory({
  transactions,
  total,
}: CapitalTransactionHistoryProps) {
  const { persons } = useUser();

  const getOwnerName = (ownerId: string) => {
    const person = persons.find((p) => p.id === ownerId);
    if (!person) return 'Account';
    return person.relationshipLabel || person.displayName;
  };

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        No capital transactions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Transaction History</h3>
        <span className="text-xs text-[var(--muted)]">{total} transactions</span>
      </div>

      <div className="space-y-2.5">
        {transactions.map((tx) => {
          const typeInfo = TX_TYPE_LABELS[tx.txType] ?? {
            label: tx.txType.replace('_', ' '),
            color: 'text-[var(--muted)] bg-[var(--background)] border-[var(--border)]',
          };
          const isReversal = tx.reversalOf != null;
          const isWithdrawal = tx.txType === 'CAPITAL_WITHDRAWAL' || tx.txType === 'PROFIT_WITHDRAWAL';
          const ownerName = getOwnerName(tx.portfolioOwnerId);

          return (
            <div
              key={tx.id}
              className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm hover:border-rose-300 dark:hover:border-rose-900/50 transition-colors ${
                isReversal ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Owner Badge */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--foreground)] bg-[var(--background)] px-2.5 py-0.5 rounded-full border border-[var(--border)]">
                      <User className="w-3 h-3 text-rose-500" />
                      {ownerName}
                    </span>

                    {/* Transaction Type Badge */}
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>

                    {isReversal && (
                      <span className="text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full font-bold">
                        REVERSAL
                      </span>
                    )}
                  </div>

                  {tx.notes && (
                    <p className="text-xs text-[var(--muted)] italic pt-0.5 flex items-start gap-1">
                      <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
                      <span>{tx.notes}</span>
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`font-bold font-mono text-base tabular-nums ${
                      isWithdrawal ? 'text-amber-500' : 'text-emerald-500'
                    }`}
                  >
                    {isWithdrawal ? '-' : '+'}{formatINR(tx.amount)}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] flex items-center justify-end gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {tx.txDate}
                  </p>
                </div>
              </div>

              {/* Adjustment details */}
              {tx.txType === 'CAPITAL_ADJUSTMENT' && tx.previousAmount != null && tx.newAmount != null && (
                <div className="mt-3 pt-2.5 border-t border-[var(--border)] grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--muted)] block text-[10px]">Previous</span>
                    <p className="font-semibold font-mono tabular-nums">{formatINR(tx.previousAmount)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--muted)] block text-[10px]">Updated</span>
                    <p className="font-semibold font-mono tabular-nums">{formatINR(tx.newAmount)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--muted)] block text-[10px]">Difference</span>
                    <p className={`font-bold font-mono tabular-nums ${(tx.adjustmentDiff ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {(tx.adjustmentDiff ?? 0) >= 0 ? '+' : ''}{formatINR(tx.adjustmentDiff ?? 0)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
