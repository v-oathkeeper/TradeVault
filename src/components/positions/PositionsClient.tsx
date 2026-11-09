'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle,
  TrendingDown,
  Shield,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ClosePositionModal } from '@/components/positions/ClosePositionModal';
import { useUser } from '@/components/providers/UserContext';
import { formatINR, formatDate, cn } from '@/lib/utils';
import type { Trade } from '@/types/app';
import Link from 'next/link';

interface PositionsClientProps {
  initialTrades: Trade[];
}

function RLevelBadge({ label, price, color }: { label: string; price: number; color: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-bold font-mono', color)}>
      <span className="font-normal opacity-70">{label}</span>
      ₹{price.toFixed(2)}
    </span>
  );
}

export function PositionsClient({ initialTrades }: PositionsClientProps) {
  const { getPersonLabel, selectedPersonId, isAdmin } = useUser();
  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [activeClosingTrade, setActiveClosingTrade] = useState<Trade | null>(null);

  React.useEffect(() => {
    setTrades(initialTrades);
  }, [initialTrades]);

  // Optimistic UI handlers
  const handleTradeClosed = useCallback((tradeId: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== tradeId));
  }, []);

  const handleRollback = useCallback((tradeToRestore: Trade) => {
    setTrades((prev) => [tradeToRestore, ...prev]);
  }, []);

  // Filter open positions and by selected person
  const openPositions = useMemo(() => {
    return trades.filter((t) => {
      if (t.status !== 'OPEN') return false;
      if (selectedPersonId !== 'combined' && t.portfolioOwnerId !== selectedPersonId) {
        return false;
      }
      return true;
    });
  }, [trades, selectedPersonId]);

  // Total invested capital in open positions
  const totalInvested = useMemo(() => {
    return openPositions.reduce(
      (sum, p) => sum + Number(p.entryPrice) * p.quantity,
      0
    );
  }, [openPositions]);

  // Total risk at stake across all open positions
  const totalRiskAtStake = useMemo(() => {
    return openPositions.reduce((sum, p) => {
      return sum + (p.initialRiskRupees ?? 0);
    }, 0);
  }, [openPositions]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Active Open Positions
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Live exposures, stop-loss tracking, and R-multiple management
          </p>
        </div>

        <div className="flex gap-3">
          <div className="p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm font-mono text-xs">
            <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
              Capital Deployed
            </span>
            <span className="text-base font-bold text-blue-500">
              {formatINR(totalInvested)}
            </span>
          </div>
          {totalRiskAtStake > 0 && (
            <div className="p-3 rounded-2xl bg-[var(--card)] border border-rose-500/30 shadow-sm font-mono text-xs">
              <span className="text-[10px] text-rose-400 uppercase font-semibold block flex items-center gap-1">
                <Shield className="w-3 h-3" /> Total Risk at Stake
              </span>
              <span className="text-base font-bold text-rose-400">
                {formatINR(totalRiskAtStake)}
              </span>
            </div>
          )}
        </div>
      </div>

      {openPositions.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No open positions currently"
          description="All recorded trades are closed. When you enter a trade without an exit price, it appears here."
          actionHref={isAdmin ? '/trades/new' : undefined}
          actionLabel={isAdmin ? 'Record Trade' : undefined}
        />
      ) : (
        <>
          {/* Position Cards — mobile + desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {openPositions.map((pos) => {
              const personLabel = getPersonLabel(pos.portfolioOwnerId);
              const brokerCode = pos.broker?.code ?? 'KITE';
              const invested = pos.entryPrice * pos.quantity;
              const currentStop = pos.currentStopLoss ?? pos.initialStopLoss;
              const stopMoved =
                pos.currentStopLoss !== null &&
                pos.initialStopLoss !== null &&
                pos.currentStopLoss !== pos.initialStopLoss;

              // Distance to stop as %
              const distanceToStopPct = currentStop
                ? Math.abs(((pos.entryPrice - currentStop) / pos.entryPrice) * 100)
                : null;

              return (
                <div
                  key={pos.id}
                  className="p-4 sm:p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4 hover:border-[var(--foreground)]/20 transition-colors"
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg font-mono text-[var(--foreground)]">
                          {pos.symbol}
                        </span>
                        <Badge variant={pos.direction === 'LONG' ? 'long' : 'short'}>
                          {pos.direction}
                        </Badge>
                        <Badge variant={brokerCode.toLowerCase() as any}>
                          {brokerCode}
                        </Badge>
                        <Badge variant={pos.tradeType === 'INTRADAY' ? 'intraday' : 'delivery'}>
                          {pos.tradeType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
                        <span className="font-medium text-[var(--foreground)]">{personLabel}</span>
                        <span>•</span>
                        <span>{formatDate(pos.entryAt)}</span>
                        {pos.strategyName && (
                          <>
                            <span>•</span>
                            <span className="text-purple-400 font-medium">{pos.strategyName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="open">OPEN</Badge>
                  </div>

                  {/* Price Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[var(--muted)] block">Qty</span>
                      <span className="font-semibold">{pos.quantity}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--muted)] block">Entry</span>
                      <span className="font-semibold">{formatINR(pos.entryPrice)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--muted)] block">Invested</span>
                      <span className="font-bold text-blue-500">{formatINR(invested)}</span>
                    </div>
                  </div>

                  {/* Stop-Loss Row */}
                  {currentStop && (
                    <div className={cn(
                      'p-3 rounded-xl border text-xs font-mono space-y-2',
                      stopMoved
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-rose-500/5 border-rose-500/30'
                    )}>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                          <TrendingDown className="w-3 h-3" />
                          Stop-Loss
                        </span>
                        {stopMoved && (
                          <span className="text-[10px] text-emerald-400 font-normal">Trailed ✓</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={cn(
                            'text-sm font-bold',
                            stopMoved ? 'text-emerald-400' : 'text-rose-400'
                          )}>
                            ₹{currentStop.toFixed(2)}
                          </span>
                          {distanceToStopPct !== null && (
                            <span className="ml-2 text-[10px] text-[var(--muted)]">
                              ({distanceToStopPct.toFixed(2)}% from entry)
                            </span>
                          )}
                        </div>
                        {pos.initialRiskRupees && (
                          <span className="text-[10px] text-rose-400">
                            1R = {formatINR(pos.initialRiskRupees)}
                          </span>
                        )}
                      </div>

                      {/* R-Level Target Badges */}
                      {pos.r1Price && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {pos.r1Price && (
                            <RLevelBadge
                              label="1R"
                              price={pos.r1Price}
                              color="text-lime-400 border-lime-500/30 bg-lime-500/10"
                            />
                          )}
                          {pos.r2Price && (
                            <RLevelBadge
                              label="2R"
                              price={pos.r2Price}
                              color="text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                            />
                          )}
                          {pos.r3Price && (
                            <RLevelBadge
                              label="3R"
                              price={pos.r3Price}
                              color="text-cyan-400 border-cyan-500/30 bg-cyan-500/10"
                            />
                          )}
                          {pos.plannedTarget && (
                            <RLevelBadge
                              label={`Target${pos.plannedRR ? ` (${pos.plannedRR.toFixed(1)}R)` : ''}`}
                              price={pos.plannedTarget}
                              color="text-purple-400 border-purple-500/30 bg-purple-500/10"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={`/trades/${pos.id}`}
                      className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-2"
                    >
                      View Details →
                    </Link>

                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveClosingTrade(pos)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs shadow-sm transition-all active:scale-[0.98]"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Close Position</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Close Position Modal */}
      <ClosePositionModal
        trade={activeClosingTrade}
        open={Boolean(activeClosingTrade)}
        onClose={() => setActiveClosingTrade(null)}
        onTradeClosed={handleTradeClosed}
        onRollback={handleRollback}
      />
    </div>
  );
}
