'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle, Minus } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import type { OwnerCapitalSummary, HouseholdCapitalSummary } from '@/types/capital';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function PnlValue({ value, className }: { value: number; className?: string }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  return (
    <span
      className={
        `font-bold tabular-nums ${
          isPositive
            ? 'text-emerald-500 dark:text-emerald-400'
            : isNegative
            ? 'text-rose-500 dark:text-rose-400'
            : 'text-[var(--foreground)]'
        } ${className ?? ''}`
      }
    >
      {isPositive ? '+' : ''}{formatINR(value)}
    </span>
  );
}

function MetricRow({
  label,
  value,
  isPnl = false,
  emphasis = false,
}: {
  label: string;
  value: number;
  isPnl?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 ${emphasis ? 'border-t border-[var(--border)] mt-1 pt-2' : ''}`}>
      <span className={`text-xs ${emphasis ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>
        {label}
      </span>
      {isPnl ? (
        <PnlValue value={value} className={emphasis ? 'text-sm' : 'text-xs'} />
      ) : (
        <span className={`font-semibold tabular-nums ${emphasis ? 'text-sm text-[var(--foreground)]' : 'text-xs text-[var(--foreground)]'}`}>
          {formatINR(value)}
        </span>
      )}
    </div>
  );
}

// ─── Single strategy bucket section (Intraday / Swing) ───────────────────────

function StrategySection({
  label,
  contributedCapital,
  currentCapital,
  netRealizedPnl,
  availableProfit,
  profitWithdrawn,
  capitalWithdrawn,
}: {
  label: string;
  contributedCapital: number;
  currentCapital: number;
  netRealizedPnl: number;
  availableProfit: number;
  profitWithdrawn: number;
  capitalWithdrawn: number;
}) {
  return (
    <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-3 space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] mb-2">
        {label}
      </p>
      <MetricRow label="Contributed Capital" value={contributedCapital} />
      <MetricRow label="Current Capital" value={currentCapital} emphasis />
      <MetricRow label="Net Realized P&L" value={netRealizedPnl} isPnl />
      <MetricRow label="Avail. for Withdrawal" value={availableProfit} isPnl />
      {profitWithdrawn > 0 && (
        <MetricRow label="Profit Withdrawn" value={profitWithdrawn} />
      )}
      {capitalWithdrawn > 0 && (
        <MetricRow label="Capital Withdrawn" value={capitalWithdrawn} />
      )}
    </div>
  );
}

// ─── Single owner card (Husband or Wife) ─────────────────────────────────────

interface OwnerCardProps {
  owner: OwnerCapitalSummary;
  isAdmin: boolean;
  onManageCapital?: () => void;
  onRecordWithdrawal?: () => void;
}

function OwnerCapitalCard({ owner, isAdmin, onManageCapital, onRecordWithdrawal }: OwnerCardProps) {
  const totalPnlPositive = owner.totalNetRealizedPnl > 0;
  const totalPnlNegative = owner.totalNetRealizedPnl < 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
      {/* Card header */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b border-[var(--border)] ${
          totalPnlPositive
            ? 'bg-emerald-500/5'
            : totalPnlNegative
            ? 'bg-rose-500/5'
            : 'bg-[var(--card)]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              totalPnlPositive
                ? 'bg-emerald-500/15 text-emerald-500'
                : totalPnlNegative
                ? 'bg-rose-500/15 text-rose-500'
                : 'bg-blue-500/10 text-blue-500'
            }`}
          >
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              {owner.displayName}&rsquo;s Portfolio
            </h3>
            <p className="text-[10px] text-[var(--muted)]">
              Current: <span className="font-semibold text-[var(--foreground)]">{formatINR(owner.totalCurrentCapital)}</span>
              &ensp;|&ensp;
              P&amp;L:{' '}
              <span
                className={
                  totalPnlPositive
                    ? 'text-emerald-500 font-semibold'
                    : totalPnlNegative
                    ? 'text-rose-500 font-semibold'
                    : 'font-semibold'
                }
              >
                {owner.totalNetRealizedPnl >= 0 ? '+' : ''}
                {formatINR(owner.totalNetRealizedPnl)}
              </span>
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onManageCapital}
              title="Manage Capital"
              className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors text-xs"
            >
              <ArrowUpCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRecordWithdrawal}
              title="Record Withdrawal"
              className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors text-xs"
            >
              <ArrowDownCircle className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Strategy sections */}
      <div className="p-3 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <StrategySection
            label="Intraday (MIS)"
            contributedCapital={owner.intraday.contributedCapital}
            currentCapital={owner.intraday.currentCapital}
            netRealizedPnl={owner.intraday.cumulativeNetRealizedPnl}
            availableProfit={owner.intraday.availableProfitForWithdrawal}
            profitWithdrawn={owner.intraday.cumulativeProfitWithdrawals}
            capitalWithdrawn={owner.intraday.cumulativeCapitalWithdrawals}
          />
          <StrategySection
            label="Swing (CNC)"
            contributedCapital={owner.swing.contributedCapital}
            currentCapital={owner.swing.currentCapital}
            netRealizedPnl={owner.swing.cumulativeNetRealizedPnl}
            availableProfit={owner.swing.availableProfitForWithdrawal}
            profitWithdrawn={owner.swing.cumulativeProfitWithdrawals}
            capitalWithdrawn={owner.swing.cumulativeCapitalWithdrawals}
          />
        </div>

        {/* Totals row */}
        <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] mb-2">
            Combined Total
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] text-[var(--muted)]">Contributed</p>
              <p className="text-xs font-bold text-[var(--foreground)] tabular-nums">
                {formatINR(owner.totalContributedCapital)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--muted)]">Current Capital</p>
              <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
                {formatINR(owner.totalCurrentCapital)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--muted)]">Net Realized P&amp;L</p>
              <PnlValue value={owner.totalNetRealizedPnl} className="text-xs" />
            </div>
            <div>
              <p className="text-[10px] text-[var(--muted)]">Avail. Profit</p>
              <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
                {formatINR(owner.totalAvailableProfitForWithdrawal)}
              </p>
            </div>
          </div>
          {(owner.totalProfitWithdrawn > 0 || owner.totalCapitalWithdrawn > 0) && (
            <div className="mt-2 pt-2 border-t border-[var(--border)] grid grid-cols-2 gap-3">
              {owner.totalProfitWithdrawn > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--muted)]">Profit Withdrawn</p>
                  <p className="text-xs font-semibold text-amber-500 tabular-nums">
                    {formatINR(owner.totalProfitWithdrawn)}
                  </p>
                </div>
              )}
              {owner.totalCapitalWithdrawn > 0 && (
                <div>
                  <p className="text-[10px] text-[var(--muted)]">Capital Withdrawn</p>
                  <p className="text-xs font-semibold text-orange-500 tabular-nums">
                    {formatINR(owner.totalCapitalWithdrawn)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Household summary strip ──────────────────────────────────────────────────

function HouseholdSummaryStrip({ summary }: { summary: HouseholdCapitalSummary }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-blue-500/5 to-indigo-500/5 p-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--muted)] mb-2">
        Household Combined
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-[var(--muted)]">Total Contributed</p>
          <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
            {formatINR(summary.combinedContributedCapital)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--muted)]">Total Current Capital</p>
          <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">
            {formatINR(summary.combinedCurrentCapital)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[var(--muted)]">Total Net P&amp;L</p>
          <PnlValue value={summary.combinedNetRealizedPnl} className="text-sm" />
        </div>
        <div>
          <p className="text-[10px] text-[var(--muted)]">Total Avail. Profit</p>
          <p className="text-sm font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">
            {formatINR(summary.combinedAvailableProfit)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

interface CapitalCardsProps {
  summary: HouseholdCapitalSummary;
  isAdmin: boolean;
  onManageCapital?: (ownerId: string) => void;
  onRecordWithdrawal?: (ownerId: string) => void;
}

export function CapitalCards({
  summary,
  isAdmin,
  onManageCapital,
  onRecordWithdrawal,
}: CapitalCardsProps) {
  if (summary.owners.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
        <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No capital data yet.</p>
        {isAdmin && (
          <p className="text-xs mt-1">
            Go to <strong>Capital</strong> to set initial contributed capital.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Individual owner cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {summary.owners.map((owner) => (
          <OwnerCapitalCard
            key={owner.portfolioOwnerId}
            owner={owner}
            isAdmin={isAdmin}
            onManageCapital={() => onManageCapital?.(owner.portfolioOwnerId)}
            onRecordWithdrawal={() => onRecordWithdrawal?.(owner.portfolioOwnerId)}
          />
        ))}
      </div>

      {/* Household combined strip (shown only when both owners have data) */}
      {summary.owners.length >= 2 && (
        <HouseholdSummaryStrip summary={summary} />
      )}
    </div>
  );
}
