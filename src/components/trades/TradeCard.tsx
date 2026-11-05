'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight, Edit2, Trash2, Eye } from 'lucide-react';
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

  return (
    <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-3">
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
