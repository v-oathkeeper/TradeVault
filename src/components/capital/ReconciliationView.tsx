'use client';

import React, { useState } from 'react';
import {
  TableProperties,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/utils';
import type {
  HouseholdCapitalSummary,
  CapitalTransaction,
  StrategyBucket,
  OwnerCapitalSummary,
} from '@/types/capital';

interface ReconciliationViewProps {
  summary: HouseholdCapitalSummary;
  transactions: CapitalTransaction[];
}

export function ReconciliationView({ summary, transactions }: ReconciliationViewProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>(
    summary.owners[0]?.portfolioOwnerId ?? ''
  );
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyBucket>('INTRADAY');

  const selectedOwner = summary.owners.find((o) => o.portfolioOwnerId === selectedOwnerId);
  const strategyData =
    selectedStrategy === 'INTRADAY' ? selectedOwner?.intraday : selectedOwner?.swing;

  // Filter transactions for this owner & strategy
  const relevantTxs = transactions.filter(
    (tx) =>
      tx.portfolioOwnerId === selectedOwnerId &&
      tx.strategyBucket === selectedStrategy &&
      tx.reversalOf == null
  );

  // Find initial allocation if any
  const initialAllocation = relevantTxs.find((tx) => tx.txType === 'INITIAL_ALLOCATION');
  const setupDate = initialAllocation ? initialAllocation.txDate : null;

  // Opening balance amount
  const openingCapital = initialAllocation ? initialAllocation.amount : 0;

  // Contributions & adjustments (excluding initial allocation)
  const additionalContributions = relevantTxs
    .filter((tx) => tx.txType === 'CAPITAL_CONTRIBUTION')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netAdjustments = relevantTxs
    .filter((tx) => tx.txType === 'CAPITAL_ADJUSTMENT')
    .reduce((sum, tx) => sum + (tx.adjustmentDiff ?? 0), 0);

  // Cumulative metrics from canonical calculation engine
  const contributedCapital = strategyData?.contributedCapital ?? 0;
  const netRealizedPnl = strategyData?.cumulativeNetRealizedPnl ?? 0;
  const profitWithdrawn = strategyData?.cumulativeProfitWithdrawals ?? 0;
  const capitalWithdrawn = strategyData?.cumulativeCapitalWithdrawals ?? 0;
  const availableProfit = strategyData?.availableProfitForWithdrawal ?? 0;
  const currentCapital = strategyData?.currentCapital ?? 0;
  const closedTrades = strategyData?.closedTradeCount ?? 0;

  // Reconciliation check
  const calculatedEquity =
    contributedCapital + netRealizedPnl - profitWithdrawn;
  const isReconciled = Math.abs(calculatedEquity - currentCapital) < 0.01;

  return (
    <div className="space-y-6">
      {/* Selector bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <TableProperties className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">Capital Reconciliation Engine</h3>
            <p className="text-[11px] text-[var(--muted)]">
              Auditable bridge between contributed capital, trading P&amp;L, and withdrawals
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedOwnerId}
            onChange={(e) => setSelectedOwnerId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {summary.owners.map((o) => (
              <option key={o.portfolioOwnerId} value={o.portfolioOwnerId}>
                {o.displayName}&rsquo;s Portfolio
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--background)] border border-[var(--border)]">
            {(['INTRADAY', 'SWING'] as StrategyBucket[]).map((bucket) => (
              <button
                key={bucket}
                onClick={() => setSelectedStrategy(bucket)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  selectedStrategy === bucket
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {bucket === 'INTRADAY' ? 'Intraday (MIS)' : 'Swing (CNC)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Setup context info banner */}
      <div className="p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
          <span>
            Reporting Start / Setup Date:{' '}
            <strong className="text-[var(--foreground)]">
              {setupDate ? formatDate(setupDate) : 'Not Yet Initialized'}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">Status:</span>
          {isReconciled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" /> Reconciled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-semibold text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" /> Reconciliation Variance
            </span>
          )}
        </div>
      </div>

      {/* Step-by-step mathematical bridge */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Balance Sheet Reconciliation Walkthrough
        </h4>

        <div className="space-y-2 text-xs">
          {/* 1. Opening Capital */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
            <div>
              <span className="font-semibold text-[var(--foreground)] block">1. Opening Contributed Capital</span>
              <span className="text-[10px] text-[var(--muted)]">
                Initial capital allocated by Admin on setup date
              </span>
            </div>
            <span className="font-bold text-sm tabular-nums text-[var(--foreground)]">
              {formatINR(openingCapital)}
            </span>
          </div>

          {/* 2. Additional Capital & Adjustments */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
            <div>
              <span className="font-semibold text-[var(--foreground)] block">
                2. Capital Additions &amp; Audited Adjustments
              </span>
              <span className="text-[10px] text-[var(--muted)]">
                Contributions (+{formatINR(additionalContributions)}) &bull; Net adjustments (
                {(netAdjustments >= 0 ? '+' : '') + formatINR(netAdjustments)})
              </span>
            </div>
            <span
              className={`font-bold text-sm tabular-nums ${
                additionalContributions + netAdjustments >= 0
                  ? 'text-emerald-500'
                  : 'text-rose-500'
              }`}
            >
              {additionalContributions + netAdjustments >= 0 ? '+' : ''}
              {formatINR(additionalContributions + netAdjustments)}
            </span>
          </div>

          {/* 3. Capital Withdrawals */}
          {capitalWithdrawn > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <div>
                <span className="font-semibold text-[var(--foreground)] block">
                  3. Contributed Capital Withdrawals
                </span>
                <span className="text-[10px] text-[var(--muted)]">
                  Permanent returns of principal capital
                </span>
              </div>
              <span className="font-bold text-sm tabular-nums text-orange-500">
                -{formatINR(capitalWithdrawn)}
              </span>
            </div>
          )}

          {/* Subtotal: Current Contributed Capital */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 font-semibold">
            <div>
              <span className="text-blue-500 block">Subtotal: Current Contributed Capital</span>
              <span className="text-[10px] text-[var(--muted)]">
                (Opening + Additions + Adjustments - Capital Withdrawals)
              </span>
            </div>
            <span className="font-bold text-sm tabular-nums text-blue-500">
              {formatINR(contributedCapital)}
            </span>
          </div>

          {/* 4. Realized Net Trading P&L */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
            <div>
              <span className="font-semibold text-[var(--foreground)] block">
                4. Cumulative Net Realized Trading P&amp;L
              </span>
              <span className="text-[10px] text-[var(--muted)]">
                From {closedTrades} closed trade executions (including partial exits, net of actual broker charges &amp; taxes)
              </span>
            </div>
            <span
              className={`font-bold text-sm tabular-nums ${
                netRealizedPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {netRealizedPnl >= 0 ? '+' : ''}
              {formatINR(netRealizedPnl)}
            </span>
          </div>

          {/* 5. Profit Withdrawals */}
          {profitWithdrawn > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--background)] border border-[var(--border)]">
              <div>
                <span className="font-semibold text-[var(--foreground)] block">
                  5. Profit Withdrawals Deducted
                </span>
                <span className="text-[10px] text-[var(--muted)]">
                  Withdrawn strictly from realized trading profit pool
                </span>
              </div>
              <span className="font-bold text-sm tabular-nums text-amber-500">
                -{formatINR(profitWithdrawn)}
              </span>
            </div>
          )}

          {/* Final Equals: Current Capital */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30">
            <div>
              <span className="font-bold text-sm text-[var(--foreground)] block">
                Current Portfolio Capital (Trading Equity)
              </span>
              <span className="text-[10px] text-[var(--muted)]">
                contributed_capital + net_realized_pnl - profit_withdrawals
              </span>
            </div>
            <span className="font-bold text-base tabular-nums text-emerald-500 dark:text-emerald-400">
              {formatINR(currentCapital)}
            </span>
          </div>
        </div>

        {/* Withdrawal Capacity Summary Box */}
        <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--muted)] block">
              Remaining Available Profit for Withdrawal
            </span>
            <span className="text-base font-bold text-emerald-500 tabular-nums">
              {formatINR(availableProfit)}
            </span>
            <p className="text-[10px] text-[var(--muted)] mt-1">
              max(0, cumulative_net_realized_pnl - cumulative_profit_withdrawals)
            </p>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-[var(--muted)] block">
              Remaining Contributed Principal
            </span>
            <span className="text-base font-bold text-[var(--foreground)] tabular-nums">
              {formatINR(contributedCapital)}
            </span>
            <p className="text-[10px] text-[var(--muted)] mt-1">
              Protected base capital allocated to {selectedStrategy.toLowerCase()} operations
            </p>
          </div>
        </div>
      </div>

      {/* Accounting Integrity Notes */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted)] space-y-1.5">
        <div className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
          <HelpCircle className="w-4 h-4 text-blue-500" />
          <span>Accounting Principles &amp; Reconciliation Standards</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
          <li>
            <strong>Single Source of Truth:</strong> Realized trading P&amp;L is derived directly from completed trade contract breakdowns (net of statutory STT, GST, SEBI, exchange fees, and DP charges).
          </li>
          <li>
            <strong>Zero Loss Overwrite:</strong> Trading profits and losses never overwrite historical contributed capital.
          </li>
          <li>
            <strong>Profit Protection:</strong> Trading losses automatically consume remaining available profit before touching contributed principal. Available profit is bounded at zero (never negative).
          </li>
          <li>
            <strong>Strategy Isolation:</strong> Intraday (MIS) and Swing (CNC) are tracked independently. A loss in Intraday never reduces Swing withdrawable profit.
          </li>
          <li>
            <strong>Immutable Ledger:</strong> All capital adjustments and withdrawals are recorded with immutable transaction IDs, timestamps, and Admin user signatures.
          </li>
        </ul>
      </div>
    </div>
  );
}
