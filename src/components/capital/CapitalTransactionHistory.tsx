'use client';

import React from 'react';
import { formatINR } from '@/lib/utils';
import type { CapitalTransaction } from '@/types/capital';

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  INITIAL_ALLOCATION:   { label: 'Initial Allocation',    color: 'text-blue-500 bg-blue-500/10'    },
  CAPITAL_CONTRIBUTION: { label: 'Capital Contribution',  color: 'text-emerald-500 bg-emerald-500/10' },
  CAPITAL_ADJUSTMENT:   { label: 'Capital Adjustment',    color: 'text-indigo-500 bg-indigo-500/10' },
  CAPITAL_WITHDRAWAL:   { label: 'Capital Withdrawal',    color: 'text-orange-500 bg-orange-500/10' },
  PROFIT_WITHDRAWAL:    { label: 'Profit Withdrawal',     color: 'text-amber-500 bg-amber-500/10'   },
};

interface CapitalTransactionHistoryProps {
  transactions: CapitalTransaction[];
  total: number;
}

export function CapitalTransactionHistory({
  transactions,
  total,
}: CapitalTransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
        No capital transactions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Transaction History</h3>
        <span className="text-xs text-[var(--muted)]">{total} total</span>
      </div>

      <div className="space-y-2">
        {transactions.map((tx) => {
          const typeInfo = TX_TYPE_LABELS[tx.txType] ?? { label: tx.txType, color: 'text-[var(--muted)] bg-[var(--background)]' };
          const isReversal = tx.reversalOf != null;
          const isWithdrawal = tx.txType === 'CAPITAL_WITHDRAWAL' || tx.txType === 'PROFIT_WITHDRAWAL';

          return (
            <div
              key={tx.id}
              className={`rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 ${isReversal ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] bg-[var(--background)] px-2 py-0.5 rounded-full border border-[var(--border)]">
                    {tx.strategyBucket === 'INTRADAY' ? 'Intraday (MIS)' : 'Swing (CNC)'}
                  </span>
                  {isReversal && (
                    <span className="text-[10px] text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      REVERSAL
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-sm tabular-nums ${isWithdrawal ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {isWithdrawal ? '-' : '+'}{formatINR(tx.amount)}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">{tx.txDate}</p>
                </div>
              </div>

              {/* Adjustment details */}
              {tx.txType === 'CAPITAL_ADJUSTMENT' && tx.previousAmount != null && tx.newAmount != null && (
                <div className="mt-2 pt-2 border-t border-[var(--border)] grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--muted)]">Old</span>
                    <p className="font-semibold tabular-nums">{formatINR(tx.previousAmount)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--muted)]">New</span>
                    <p className="font-semibold tabular-nums">{formatINR(tx.newAmount)}</p>
                  </div>
                  <div>
                    <span className="text-[var(--muted)]">Diff</span>
                    <p className={`font-bold tabular-nums ${(tx.adjustmentDiff ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {(tx.adjustmentDiff ?? 0) >= 0 ? '+' : ''}{formatINR(tx.adjustmentDiff ?? 0)}
                    </p>
                  </div>
                </div>
              )}

              {tx.notes && (
                <p className="text-xs text-[var(--muted)] mt-1.5 italic">&ldquo;{tx.notes}&rdquo;</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
