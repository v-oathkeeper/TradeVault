'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, History } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PnlDisplay } from '@/components/ui/PnlDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { useUser } from '@/components/providers/UserContext';
import type { Trade } from '@/types/app';

interface RecentTradesListProps {
  trades: Trade[];
}

export function RecentTradesList({ trades }: RecentTradesListProps) {
  const { getPersonLabel } = useUser();

  if (!trades || trades.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
        <EmptyState
          icon={History}
          title="No trades recorded yet"
          description="Click 'Record Trade' to add your first intraday or delivery trade."
          actionHref="/trades/new"
          actionLabel="Record Trade"
        />
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)]">
            Recent Trades
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Latest executions across all portfolios
          </p>
        </div>
        <Link
          href="/trades"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {trades.slice(0, 5).map((trade) => {
          const personLabel = getPersonLabel(trade.portfolioOwnerId);
          const brokerCode = trade.broker?.code ?? 'KITE';

          return (
            <Link
              key={trade.id}
              href={`/trades/${trade.id}`}
              className="py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--background)]/50 -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center font-bold text-xs font-mono text-blue-500 shrink-0">
                  {trade.symbol.slice(0, 3)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[var(--foreground)] truncate">
                      {trade.symbol}
                    </span>
                    <Badge variant={trade.tradeType === 'INTRADAY' ? 'intraday' : 'delivery'}>
                      {trade.tradeType}
                    </Badge>
                    <Badge variant={brokerCode.toLowerCase() as 'kite' | 'shoonya'}>
                      {brokerCode}
                    </Badge>
                    {trade.strategyName && (
                      <span className="text-[10px] text-purple-400 font-medium">
                        #{trade.strategyName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
                    <span>{personLabel}</span>
                    <span>•</span>
                    <span>{trade.quantity} qty</span>
                    <span>•</span>
                    <span>{formatDate(trade.entryAt)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                {trade.status === 'OPEN' ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="open">OPEN</Badge>
                    {(trade.currentStopLoss ?? trade.initialStopLoss) && (
                      <span className="text-[10px] text-rose-400 font-mono hidden sm:inline">
                        SL ₹{(trade.currentStopLoss ?? trade.initialStopLoss)?.toFixed(1)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-end">
                    <PnlDisplay value={trade.netPnl} size="sm" />
                    {trade.realizedRMultiple != null && (
                      <span className={`text-[10px] font-mono font-bold ${trade.realizedRMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trade.realizedRMultiple >= 0 ? '+' : ''}{trade.realizedRMultiple.toFixed(2)}R
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
