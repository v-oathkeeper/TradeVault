'use client';

import React from 'react';
import {
  Wallet,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Heart,
  Coins,
  History,
  ShieldCheck,
  User,
  Sparkles,
} from 'lucide-react';
import { formatINR } from '@/lib/utils';
import type { HouseholdCapitalSummary, OwnerCapitalSummary } from '@/types/capital';

interface CapitalCardsProps {
  summary: HouseholdCapitalSummary;
  isAdmin: boolean;
  onAddMoney?: (ownerId?: string) => void;
  onWithdrawMoney?: (ownerId?: string) => void;
  onSetInitialCapital?: () => void;
}

export function CapitalCards({
  summary,
  isAdmin,
  onAddMoney,
  onWithdrawMoney,
  onSetInitialCapital,
}: CapitalCardsProps) {
  const husbandOwner =
    summary.owners.find(
      (o) =>
        o.relationshipLabel.toLowerCase().includes('husband') ||
        o.displayName.toLowerCase().includes('husband')
    ) || summary.owners[0];

  const wifeOwner =
    summary.owners.find(
      (o) =>
        o.relationshipLabel.toLowerCase().includes('wife') ||
        o.displayName.toLowerCase().includes('wife')
    ) || summary.owners[1];

  return (
    <div className="space-y-6">
      {/* ── 1. Couple's Combined Overview Banner ───────────────────────── */}
      <div className="rounded-3xl border border-rose-200/60 dark:border-rose-900/40 bg-gradient-to-br from-rose-500/5 via-champagne-500/5 to-lavender-500/5 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-md">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Couple's Capital Overview</h3>
              <p className="text-xs text-[var(--muted)]">Joint trading portfolio summary & combined totals</p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onSetInitialCapital}
                className="px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--background)] text-xs font-semibold text-[var(--foreground)] transition-all shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                <span>Set Initial Capital</span>
              </button>
              <button
                type="button"
                onClick={() => onAddMoney?.()}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                <span>Add Money</span>
              </button>
              <button
                type="button"
                onClick={() => onWithdrawMoney?.()}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span>Withdraw Money</span>
              </button>
            </div>
          )}
        </div>

        {/* Combined Figures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
          {/* Combined Invested Capital */}
          <div className="rounded-2xl bg-[var(--card)]/80 backdrop-blur-sm border border-[var(--border)] p-4 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider block">
              Combined Invested Capital
            </span>
            <p className="text-2xl font-bold font-mono text-[var(--foreground)] tabular-nums">
              {formatINR(summary.combinedInvestedCapital)}
            </p>
            <div className="pt-2 text-[11px] text-[var(--muted)] flex items-center justify-between border-t border-[var(--border)] mt-2">
              <span>Husband: {formatINR(husbandOwner?.investedCapital ?? 0)}</span>
              <span>Wife: {formatINR(wifeOwner?.investedCapital ?? 0)}</span>
            </div>
          </div>

          {/* Combined Available Profit */}
          <div className="rounded-2xl bg-[var(--card)]/80 backdrop-blur-sm border border-[var(--border)] p-4 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider block">
              Available Profit for Withdrawal
            </span>
            <p className="text-2xl font-bold font-mono text-emerald-500 dark:text-emerald-400 tabular-nums">
              {formatINR(summary.combinedAvailableProfit)}
            </p>
            <div className="pt-2 text-[11px] text-[var(--muted)] flex items-center justify-between border-t border-[var(--border)] mt-2">
              <span>Husband: {formatINR(husbandOwner?.availableProfit ?? 0)}</span>
              <span>Wife: {formatINR(wifeOwner?.availableProfit ?? 0)}</span>
            </div>
          </div>

          {/* Combined All-time Profit */}
          <div className="rounded-2xl bg-[var(--card)]/80 backdrop-blur-sm border border-[var(--border)] p-4 space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider block">
              All-Time Net Realized Profit
            </span>
            <p
              className={`text-2xl font-bold font-mono tabular-nums ${
                summary.combinedAllTimeProfit >= 0
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : 'text-rose-500 dark:text-rose-400'
              }`}
            >
              {summary.combinedAllTimeProfit >= 0 ? '+' : ''}
              {formatINR(summary.combinedAllTimeProfit)}
            </p>
            <div className="pt-2 text-[11px] text-[var(--muted)] flex items-center justify-between border-t border-[var(--border)] mt-2">
              <span>Husband: {formatINR(husbandOwner?.allTimeProfit ?? 0)}</span>
              <span>Wife: {formatINR(wifeOwner?.allTimeProfit ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Individual Account Cards (Husband & Wife) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {summary.owners.map((owner) => {
          const isHusband =
            owner.relationshipLabel.toLowerCase().includes('husband') ||
            owner.displayName.toLowerCase().includes('husband');

          return (
            <div
              key={owner.portfolioOwnerId}
              className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm space-y-4 hover:border-rose-300 dark:hover:border-rose-900/50 transition-all"
            >
              {/* Account Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm ${
                      isHusband
                        ? 'bg-rose-500/10 text-rose-500'
                        : 'bg-lavender-500/10 text-purple-500 dark:text-purple-400'
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-[var(--foreground)]">
                      {owner.displayName}{' '}
                      <span className="text-xs font-normal text-[var(--muted)]">
                        ({owner.relationshipLabel})
                      </span>
                    </h4>
                    <p className="text-[11px] text-[var(--muted)]">Individual financial record</p>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAddMoney?.(owner.portfolioOwnerId)}
                      className="p-1.5 rounded-xl hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-[var(--border)] text-xs font-semibold flex items-center gap-1 transition-colors"
                      title={`Add money to ${owner.displayName}`}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onWithdrawMoney?.(owner.portfolioOwnerId)}
                      className="p-1.5 rounded-xl hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-[var(--border)] text-xs font-semibold flex items-center gap-1 transition-colors"
                      title={`Withdraw money from ${owner.displayName}`}
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Withdraw</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Individual Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-0.5">
                  <span className="text-[10px] uppercase font-semibold text-[var(--muted)] block">
                    Invested Capital
                  </span>
                  <span className="text-lg font-bold font-mono text-[var(--foreground)] tabular-nums">
                    {formatINR(owner.investedCapital)}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] block pt-1">
                    Initial: {formatINR(owner.initialCapital)}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-0.5">
                  <span className="text-[10px] uppercase font-semibold text-[var(--muted)] block">
                    Avail. for Withdrawal
                  </span>
                  <span className="text-lg font-bold font-mono text-emerald-500 dark:text-emerald-400 tabular-nums">
                    {formatINR(owner.availableProfit)}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] block pt-1">
                    Withdrawn: {formatINR(owner.profitWithdrawn)}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-0.5 col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-semibold text-[var(--muted)] block">
                      All-Time Net Realized Profit
                    </span>
                    <span
                      className={`text-base font-bold font-mono tabular-nums ${
                        owner.allTimeProfit >= 0
                          ? 'text-emerald-500 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400'
                      }`}
                    >
                      {owner.allTimeProfit >= 0 ? '+' : ''}
                      {formatINR(owner.allTimeProfit)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1 border-t border-[var(--border)] mt-1">
                    <span>Additional Capital Added: {formatINR(owner.additionalCapital)}</span>
                    <span>Capital Withdrawn: {formatINR(owner.capitalWithdrawn)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
