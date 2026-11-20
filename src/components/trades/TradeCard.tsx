'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Eye, Shield, Target } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PnlDisplay } from '@/components/ui/PnlDisplay';
import { formatDate, formatINR, cn } from '@/lib/utils';
import { useUser } from '@/components/providers/UserContext';
import type { Trade } from '@/types/app';

interface TradeCardProps {
  trade: Trade;
  onDelete?: (tradeId: string) => void;
}

export function TradeCard({ trade, onDelete }: TradeCardProps) {
  const { getPersonLabel, isAdmin } = useUser();
  const personLabel = getPersonLabel(trade.portfolioOwnerId);
  const brokerCode = trade.broker?.code ?? 'KITE';
  const milestones = [
    {
      label: 'M1',
      target: trade.milestone1Target ?? trade.milestone1_target,
      trailingSl: trade.milestone1TrailingSl ?? trade.milestone1_trailing_sl,
    },
    {
      label: 'M2',
      target: trade.milestone2Target ?? trade.milestone2_target,
      trailingSl: trade.milestone2TrailingSl ?? trade.milestone2_trailing_sl,
    },
    {
      label: 'M3',
      target: trade.milestone3Target ?? trade.milestone3_target,
      trailingSl: trade.milestone3TrailingSl ?? trade.milestone3_trailing_sl,
    },
  ];
  const activeStop =
    trade.currentTrailingSl ??
    trade.current_trailing_sl ??
    trade.currentStopLoss ??
    trade.initialStopLoss;
  const hasMilestonePlan = milestones.some(
    (milestone) => milestone.target != null || milestone.trailingSl != null
  );

  return (
    <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-3 card-hover animate-slide-up transition-all">
      {/* Header: Symbol, Badges, Net P&L */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-[var(--foreground)] font-mono">
              {trade.symbol}
            </span>
            <Badge
              variant={trade.direction === 'LONG' ? 'long' : 'short'}
              className="text-[10px]"
            >
              {trade.direction === 'LONG' ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {trade.direction}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--foreground)]">
              {personLabel}
            </span>
            <span>•</span>
            <Badge variant={brokerCode.toLowerCase() as 'kite' | 'shoonya'}>
              {brokerCode}
            </Badge>
            <span>•</span>
            <Badge
              variant={trade.tradeType === 'INTRADAY' ? 'intraday' : 'delivery'}
            >
              {trade.tradeType}
            </Badge>
          </div>
        </div>

        <div className="text-right">
          {trade.status === 'OPEN' ? (
            <Badge variant="open">OPEN</Badge>
          ) : (
            <PnlDisplay value={trade.netPnl} size="md" />
          )}
        </div>
      </div>

      {/* Trade metrics grid */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono">
        <div>
          <span className="text-[10px] text-[var(--muted)] block">Qty</span>
          <span className="font-semibold">{trade.quantity}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--muted)] block">Entry</span>
          <span className="font-semibold">{formatINR(trade.entryPrice)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--muted)] block">Exit</span>
          <span className="font-semibold">
            {trade.exitPrice ? formatINR(trade.exitPrice) : '—'}
          </span>
        </div>
      </div>

      {(hasMilestonePlan || activeStop != null) && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <Target className="h-3.5 w-3.5 text-blue-500" />
              Milestones &amp; Stops
            </span>
            {activeStop != null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500">
                <Shield className="h-3 w-3" />
                Active SL {formatINR(activeStop)}
              </span>
            )}
          </div>

          {hasMilestonePlan && (
            <div className="grid grid-cols-3 gap-2">
              {milestones.map((milestone) => (
                <div key={milestone.label} className="min-w-0 rounded-lg bg-[var(--card)] px-2 py-1.5">
                  <span className="block text-[9px] font-semibold text-[var(--muted)]">
                    {milestone.label}
                  </span>
                  <span className="block truncate font-mono text-[11px] font-bold text-[var(--foreground)]">
                    {milestone.target != null ? formatINR(milestone.target) : '—'}
                  </span>
                  {milestone.trailingSl != null && (
                    <span className="block truncate font-mono text-[9px] text-rose-500">
                      Trail {formatINR(milestone.trailingSl)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Date & Actions */}
      <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-1">
        <span>{formatDate(trade.entryAt, { includeTime: true })}</span>

        <div className="flex items-center gap-1">
          <Link
            href={`/trades/${trade.id}`}
            className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-blue-500 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Link>
          {isAdmin && (
            <>
              <Link
                href={`/trades/${trade.id}/edit`}
                className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-amber-500 transition-colors"
                title="Edit Trade"
              >
                <Edit2 className="w-4 h-4" />
              </Link>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(trade.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-rose-500 transition-colors"
                  title="Delete Trade"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
