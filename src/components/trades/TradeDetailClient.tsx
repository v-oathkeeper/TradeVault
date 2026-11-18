'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit2,
  Receipt,
  TrendingDown,
  TrendingUp,
  Tag,
  Sparkles,
  Shield,
  Clock,
  CheckCircle2,
  User,
  Coins,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PnlDisplay } from '@/components/ui/PnlDisplay';
import { StopLossManager } from '@/components/positions/StopLossManager';
import { ImportGeminiMilestonesModal } from '@/components/trades/ImportGeminiMilestonesModal';
import { formatINR, formatDate } from '@/lib/utils';
import type { Trade, StopLossHistoryEntry, TradeMilestoneHistoryEntry } from '@/types/app';

interface TradeDetailClientProps {
  trade: Trade;
  stopHistory: StopLossHistoryEntry[];
  milestoneHistory: TradeMilestoneHistoryEntry[];
  isAdmin: boolean;
  breakdown: Record<string, any>;
  turnover: number;
  returnPct: number | null;
}

export function TradeDetailClient({
  trade,
  stopHistory,
  milestoneHistory,
  isAdmin,
  breakdown,
  turnover,
  returnPct,
}: TradeDetailClientProps) {
  const router = useRouter();
  const [showGeminiModal, setShowGeminiModal] = useState(false);

  const m1 = {
    target: trade.milestone1Target,
    status: trade.milestone1Status || 'PENDING',
    trailingSl: trade.milestone1TrailingSl,
  };
  const m2 = {
    target: trade.milestone2Target,
    status: trade.milestone2Status || 'PENDING',
    trailingSl: trade.milestone2TrailingSl,
  };
  const m3 = {
    target: trade.milestone3Target,
    status: trade.milestone3Status || 'PENDING',
    trailingSl: trade.milestone3TrailingSl,
  };

  const hasMilestones =
    m1.target != null ||
    m2.target != null ||
    m3.target != null ||
    trade.currentTrailingSl != null;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 w-full">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/trades"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Journal</span>
        </Link>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGeminiModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-semibold hover:bg-purple-500/20 transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Import Gemini Update</span>
            </button>
            <Link
              href={`/trades/${trade.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--card)] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Edit Record</span>
            </Link>
          </div>
        )}
      </div>

      {/* Hero Card */}
      <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold font-mono text-[var(--foreground)]">
                {trade.symbol}
              </h1>
              <Badge variant={trade.tradeType === 'INTRADAY' ? 'intraday' : 'delivery'}>
                {trade.tradeType}
              </Badge>
              <Badge variant={(trade.broker?.code ?? 'KITE').toLowerCase() as any}>
                {trade.broker?.name ?? 'Broker'}
              </Badge>
              <Badge variant={trade.status === 'OPEN' ? 'open' : 'closed'}>
                {trade.status}
              </Badge>
              {trade.strategyName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <Tag className="w-2.5 h-2.5" />
                  {trade.strategyName}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-rose-500" />
              <span>Account Owner:</span>
              <span className="font-semibold text-[var(--foreground)]">
                {trade.portfolioOwner?.displayName}
              </span>{' '}
              ({trade.portfolioOwner?.relationshipLabel})
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] block font-semibold">
              Net Realized Return
            </span>
            <PnlDisplay value={trade.netPnl} percentage={returnPct} size="xl" showIcon />
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[var(--border)] text-xs font-mono">
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Quantity</span>
            <span className="text-sm font-bold">{trade.quantity} shares</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Entry Price</span>
            <span className="text-sm font-bold">{formatINR(trade.entryPrice)}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Exit Price</span>
            <span className="text-sm font-bold">
              {trade.exitPrice ? formatINR(trade.exitPrice) : 'OPEN'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--muted)] uppercase block">Total Turnover</span>
            <span className="text-sm font-bold">{formatINR(turnover)}</span>
          </div>
        </div>
      </div>

      {/* ── GEMINI MILESTONES & TRAILING STOP-LOSS SECTION ──────────── */}
      <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-500 to-rose-500 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">
                Gemini Milestones &amp; Trailing Stop-Loss
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Targets and dynamic trailing stop-loss imported from Gemini trading skill
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowGeminiModal(true)}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--card)] text-xs font-semibold text-[var(--foreground)] transition-colors shadow-sm"
            >
              Update Milestones
            </button>
          )}
        </div>

        {hasMilestones ? (
          <div className="space-y-4">
            {/* Milestones 1, 2, 3 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Milestone 1', m: m1 },
                { label: 'Milestone 2', m: m2 },
                { label: 'Milestone 3', m: m3 },
              ].map(({ label, m }, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)]">
                      {label}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        m.status === 'REACHED'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : m.status === 'MISSED'
                          ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Target Price</span>
                    <span className="text-base font-bold font-mono text-[var(--foreground)]">
                      {m.target != null ? formatINR(m.target) : '—'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Trailing Stop-Loss</span>
                    <span className="text-xs font-mono font-semibold text-rose-500">
                      {m.trailingSl != null ? formatINR(m.trailingSl) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Current Active Trailing SL & Last Reached Milestone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/5 to-purple-500/5 border border-rose-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                    Active Trailing Stop-Loss
                  </span>
                  <span className="text-lg font-bold font-mono text-rose-500">
                    {trade.currentTrailingSl != null
                      ? formatINR(trade.currentTrailingSl)
                      : trade.currentStopLoss != null
                      ? formatINR(trade.currentStopLoss)
                      : 'Not set'}
                  </span>
                </div>
                <Shield className="w-6 h-6 text-rose-500/50" />
              </div>

              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/5 to-rose-500/5 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                    Last Reached Milestone
                  </span>
                  <span className="text-base font-bold text-[var(--foreground)]">
                    {trade.lastReachedMilestone || 'None yet'}
                  </span>
                  {trade.milestonesUpdatedAt && (
                    <span className="text-[10px] text-[var(--muted)] block mt-0.5">
                      Updated: {formatDate(trade.milestonesUpdatedAt)}
                    </span>
                  )}
                </div>
                <TrendingUp className="w-6 h-6 text-purple-500/50" />
              </div>
            </div>

            {/* Milestone Update History Timeline */}
            {milestoneHistory.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-2.5">
                <span className="text-xs font-bold text-[var(--foreground)] block">
                  Milestone Update History ({milestoneHistory.length})
                </span>
                <div className="space-y-2">
                  {milestoneHistory.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-rose-500">
                          {h.lastReachedMilestone || 'Milestone Update'}
                        </span>
                        <span className="text-[var(--muted)]">{formatDate(h.createdAt)}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-[var(--muted)]">
                        <span>M1: {h.milestone1Target ? formatINR(h.milestone1Target) : '—'}</span>
                        <span>M2: {h.milestone2Target ? formatINR(h.milestone2Target) : '—'}</span>
                        <span>M3: {h.milestone3Target ? formatINR(h.milestone3Target) : '—'}</span>
                        <span>Active SL: {h.currentTrailingSl ? formatINR(h.currentTrailingSl) : '—'}</span>
                      </div>
                      {h.notes && (
                        <p className="text-[10px] font-sans text-[var(--muted)] italic pt-0.5">
                          &ldquo;{h.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-dashed border-[var(--border)] text-center space-y-2">
            <Sparkles className="w-6 h-6 text-[var(--muted)] mx-auto opacity-40" />
            <p className="text-xs text-[var(--muted)]">No Gemini milestone updates imported yet for this trade.</p>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowGeminiModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white font-semibold text-xs shadow-sm transition-all"
              >
                Import Gemini Milestones
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── STOP LOSS MANAGER (AUDIT TRAIL) ────────────────────────── */}
      <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--foreground)]">Stop-Loss Audit History</h3>
            <p className="text-xs text-[var(--muted)]">
              Historical trail adjustments and execution safeguards
            </p>
          </div>
        </div>

        <StopLossManager
          trade={trade}
          stopHistory={stopHistory}
          isAdmin={isAdmin}
          onUpdated={() => router.refresh()}
        />
      </div>

      {/* ── CHARGES & BROKER EXPENSE BREAKDOWN ──────────────────────── */}
      <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Broker Fee &amp; Tax Breakdown</h3>
              <p className="text-xs text-[var(--muted)]">Exact regulatory charges and statutory duties</p>
            </div>
          </div>
          <span className="text-sm font-bold font-mono text-[var(--foreground)]">
            Total: {formatINR(trade.totalCharges)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] block">Brokerage</span>
            <span className="font-bold">{formatINR(breakdown.brokerage ?? 0)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] block">STT / CTT</span>
            <span className="font-bold">{formatINR(breakdown.stt ?? 0)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] block">Exchange Charges</span>
            <span className="font-bold">{formatINR(breakdown.exchangeCharges ?? 0)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] block">GST</span>
            <span className="font-bold">{formatINR(breakdown.gst ?? 0)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] block">SEBI Charges</span>
            <span className="font-bold">{formatINR(breakdown.sebiCharges ?? 0)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
            <span className="text-[10px] text-[var(--muted)] block">Stamp Duty</span>
            <span className="font-bold">{formatINR(breakdown.stampDuty ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Gemini Modal */}
      {isAdmin && (
        <ImportGeminiMilestonesModal
          open={showGeminiModal}
          onClose={() => setShowGeminiModal(false)}
          onSuccess={() => router.refresh()}
          preselectedTradeId={trade.id}
          preselectedSymbol={trade.symbol}
        />
      )}
    </div>
  );
}
