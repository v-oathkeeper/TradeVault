'use client';

import React, { useState, useCallback } from 'react';
import { TrendingDown, TrendingUp, ArrowRight, Shield, Clock, AlertTriangle, CheckCircle, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatINR } from '@/lib/utils';
import type { Trade, StopLossHistoryEntry, StopLossUpdateType } from '@/types/app';

interface StopLossManagerProps {
  trade: Trade;
  stopHistory: StopLossHistoryEntry[];
  isAdmin: boolean;
  onUpdated?: () => void;
}

const STOP_TYPE_LABELS: Record<StopLossUpdateType, { label: string; color: string; icon: React.ReactNode }> = {
  INITIAL: {
    label: 'Initial',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    icon: <Shield className="w-3 h-3" />,
  },
  TRAIL: {
    label: 'Trail',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    icon: <TrendingUp className="w-3 h-3" />,
  },
  BREAKEVEN: {
    label: 'Breakeven',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    icon: <Minus className="w-3 h-3" />,
  },
  PARTIAL_CLOSE: {
    label: 'Partial Close',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  MANUAL: {
    label: 'Manual',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

export function StopLossManager({
  trade,
  stopHistory,
  isAdmin,
  onUpdated,
}: StopLossManagerProps) {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    newStopLoss: trade.currentStopLoss ?? trade.initialStopLoss ?? 0,
    stopType: 'TRAIL' as StopLossUpdateType,
    marketPriceAtUpdate: '',
    notes: '',
  });

  const handleUpdate = useCallback(async () => {
    if (!updateForm.newStopLoss) {
      toast.error('New stop-loss price is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/trades/${trade.id}/stop-loss`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStopLoss: Number(updateForm.newStopLoss),
          stopType: updateForm.stopType,
          marketPriceAtUpdate: updateForm.marketPriceAtUpdate
            ? Number(updateForm.marketPriceAtUpdate)
            : null,
          notes: updateForm.notes || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update stop-loss');

      toast.success('Stop-loss updated', {
        description: `New stop: ₹${Number(updateForm.newStopLoss).toFixed(2)} (${updateForm.stopType})`,
      });

      setShowUpdateModal(false);
      onUpdated?.();
    } catch (err: any) {
      toast.error('Could not update stop-loss', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  }, [updateForm, trade.id, onUpdated]);

  // Set breakeven shortcut
  const setBreakeven = () => {
    setUpdateForm((f) => ({
      ...f,
      newStopLoss: trade.entryPrice,
      stopType: 'BREAKEVEN',
      notes: 'Moved to breakeven',
    }));
  };

  const currentStop = trade.currentStopLoss ?? trade.initialStopLoss;
  const stopMoved = trade.currentStopLoss !== null &&
    trade.initialStopLoss !== null &&
    trade.currentStopLoss !== trade.initialStopLoss;

  return (
    <div className="space-y-4">
      {/* Current Stop-Loss Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3 text-blue-400" />
            Initial Stop-Loss
          </span>
          <div className="text-base font-bold font-mono text-rose-400">
            ₹{trade.initialStopLoss?.toFixed(2) ?? '—'}
          </div>
          {trade.initialRiskRupees && (
            <div className="text-[10px] text-[var(--muted)]">
              1R = {formatINR(trade.initialRiskRupees)}
              {trade.initialRiskPct && ` (${trade.initialRiskPct.toFixed(2)}%)`}
            </div>
          )}
        </div>

        <div className={cn(
          'p-3.5 rounded-xl border space-y-1',
          stopMoved
            ? 'bg-emerald-500/5 border-emerald-500/30'
            : 'bg-[var(--background)] border-[var(--border)]'
        )}>
          <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className={cn('w-3 h-3', stopMoved ? 'text-emerald-400' : 'text-[var(--muted)]')} />
            Current Stop-Loss
          </span>
          <div className={cn(
            'text-base font-bold font-mono',
            stopMoved ? 'text-emerald-400' : 'text-rose-400'
          )}>
            ₹{currentStop?.toFixed(2) ?? '—'}
          </div>
          {stopMoved && trade.initialStopLoss && currentStop && (
            <div className="text-[10px] text-emerald-400">
              Trailed ₹{(currentStop - trade.initialStopLoss).toFixed(2)} from initial
            </div>
          )}
        </div>

        {/* Distance to breakeven */}
        <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
            <Minus className="w-3 h-3 text-cyan-400" />
            Breakeven Level
          </span>
          <div className="text-base font-bold font-mono text-cyan-400">
            ₹{trade.entryPrice.toFixed(2)}
          </div>
          {currentStop && currentStop !== trade.entryPrice && (
            <div className="text-[10px] text-[var(--muted)]">
              {trade.direction === 'LONG'
                ? currentStop < trade.entryPrice
                  ? `₹${(trade.entryPrice - currentStop).toFixed(2)} to breakeven`
                  : 'Above breakeven ✓'
                : currentStop > trade.entryPrice
                ? `₹${(currentStop - trade.entryPrice).toFixed(2)} to breakeven`
                : 'Below breakeven ✓'}
            </div>
          )}
        </div>
      </div>

      {/* R-Level Targets */}
      {trade.r1Price && (
        <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2.5">
          <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            R-Multiple Price Levels
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { label: '1R', price: trade.r1Price, color: 'text-lime-400 border-lime-500/30 bg-lime-500/10' },
              { label: '2R', price: trade.r2Price, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
              { label: '3R', price: trade.r3Price, color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
            ].filter((r) => r.price !== null).map(({ label, price, color }) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono',
                  color
                )}
              >
                <span className="font-normal opacity-70">{label}</span>
                ₹{(price as number).toFixed(2)}
              </div>
            ))}
            {trade.plannedTarget && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono text-purple-400 border-purple-500/30 bg-purple-500/10">
                <span className="font-normal opacity-70">Target</span>
                ₹{trade.plannedTarget.toFixed(2)}
                {trade.plannedRR && (
                  <span className="text-[9px] opacity-70 ml-1">({trade.plannedRR.toFixed(1)}R)</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin: Update Stop-Loss */}
      {isAdmin && trade.status === 'OPEN' && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowUpdateModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white text-xs font-semibold shadow-md shadow-rose-500/20 transition-all active:scale-[0.98]"
          >
            <TrendingDown className="w-3.5 h-3.5" />
            Update Stop-Loss
          </button>
          <button
            onClick={() => {
              setBreakeven();
              setShowUpdateModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-xs font-semibold transition-all"
          >
            <Minus className="w-3.5 h-3.5" />
            Move to Breakeven
          </button>
        </div>
      )}

      {/* Stop-Loss History Timeline */}
      {stopHistory.length > 0 && (
        <div className="space-y-2.5">
          <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Stop-Loss History ({stopHistory.length} update{stopHistory.length !== 1 ? 's' : ''})
          </span>
          <div className="relative pl-4">
            {/* Timeline line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-[var(--border)] ml-1.5" />

            <div className="space-y-3">
              {stopHistory.map((entry, idx) => {
                const typeInfo = STOP_TYPE_LABELS[entry.stopType];
                const isLatest = idx === stopHistory.length - 1;
                const moved = entry.previousStop !== null && entry.previousStop !== entry.newStop;
                const increase = entry.previousStop !== null && entry.newStop > entry.previousStop;

                return (
                  <div key={entry.id} className="relative pl-4">
                    {/* Dot */}
                    <div className={cn(
                      'absolute left-0 top-2 w-3 h-3 rounded-full border-2',
                      isLatest
                        ? 'bg-[var(--foreground)] border-[var(--foreground)]'
                        : 'bg-[var(--border)] border-[var(--border)]'
                    )} style={{ marginLeft: '-6px' }} />

                    <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-semibold',
                            typeInfo.color
                          )}>
                            {typeInfo.icon}
                            {typeInfo.label}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                            {entry.previousStop !== null && (
                              <>
                                <span className="text-[var(--muted)]">₹{entry.previousStop.toFixed(2)}</span>
                                <ArrowRight className="w-3 h-3 text-[var(--muted)]" />
                              </>
                            )}
                            <span className={cn(
                              moved
                                ? increase ? 'text-emerald-400' : 'text-rose-400'
                                : 'text-[var(--foreground)]'
                            )}>
                              ₹{entry.newStop.toFixed(2)}
                            </span>
                            {moved && (
                              <span className={cn(
                                'text-[10px]',
                                increase ? 'text-emerald-400' : 'text-rose-400'
                              )}>
                                ({increase ? '+' : ''}{(entry.newStop - (entry.previousStop ?? 0)).toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-[var(--muted)] font-mono">
                          {new Date(entry.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {entry.marketPriceAtUpdate && (
                        <div className="text-[10px] text-[var(--muted)]">
                          Market price: ₹{entry.marketPriceAtUpdate.toFixed(2)}
                          {entry.floatingRAtUpdate !== null && (
                            <span className="ml-2">
                              Floating R: {entry.floatingRAtUpdate >= 0 ? '+' : ''}
                              {entry.floatingRAtUpdate.toFixed(2)}R
                            </span>
                          )}
                        </div>
                      )}
                      {entry.notes && (
                        <p className="text-[11px] text-[var(--muted)] italic">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Update Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 animate-in slide-in-from-bottom-4 duration-200">
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Update Stop-Loss</h3>
              <p className="text-xs text-[var(--muted)] mt-1">
                Current: ₹{currentStop?.toFixed(2) ?? '—'} → Set new stop
              </p>
            </div>

            {/* Stop Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--foreground)]">Update Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['TRAIL', 'BREAKEVEN', 'PARTIAL_CLOSE', 'MANUAL'] as StopLossUpdateType[]).map((type) => {
                  const info = STOP_TYPE_LABELS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setUpdateForm((f) => ({ ...f, stopType: type }));
                        if (type === 'BREAKEVEN') setBreakeven();
                      }}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all',
                        updateForm.stopType === type
                          ? info.color
                          : 'text-[var(--muted)] border-[var(--border)] hover:border-[var(--foreground)]/30'
                      )}
                    >
                      {info.icon}
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* New Stop-Loss Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                New Stop-Loss (₹)
              </label>
              <input
                type="number"
                step="0.05"
                value={updateForm.newStopLoss}
                onChange={(e) =>
                  setUpdateForm((f) => ({ ...f, newStopLoss: Number(e.target.value) }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-rose-500/50 text-sm font-bold font-mono focus:border-rose-400 transition-colors"
              />
            </div>

            {/* Market Price (optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Current Market Price (₹) <span className="text-[var(--muted)] font-normal">(optional)</span>
              </label>
              <input
                type="number"
                step="0.05"
                placeholder="For MAE/MFE tracking"
                value={updateForm.marketPriceAtUpdate}
                onChange={(e) =>
                  setUpdateForm((f) => ({ ...f, marketPriceAtUpdate: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-mono focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">Notes</label>
              <input
                type="text"
                placeholder="Reason for the update..."
                value={updateForm.notes}
                onChange={(e) => setUpdateForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowUpdateModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--background)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-orange-600 text-white text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? 'Updating...' : 'Update Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
