'use client';

import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import type { StrategyBucket, OwnerCapitalSummary } from '@/types/capital';

interface RecordWithdrawalModalProps {
  open: boolean;
  owners: OwnerCapitalSummary[];
  initialOwnerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordWithdrawalModal({
  open,
  owners,
  initialOwnerId,
  onClose,
  onSuccess,
}: RecordWithdrawalModalProps) {
  const today = new Date().toISOString().split('T')[0];

  const [ownerId, setOwnerId] = useState(initialOwnerId ?? owners[0]?.portfolioOwnerId ?? '');
  const [strategyBucket, setStrategyBucket] = useState<StrategyBucket>('INTRADAY');
  const [withdrawalType, setWithdrawalType] = useState<'PROFIT' | 'CAPITAL'>('PROFIT');
  const [amount, setAmount] = useState('');
  const [txDate, setTxDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [overrideConfirm, setOverrideConfirm] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  if (!open) return null;

  const selectedOwner = owners.find((o) => o.portfolioOwnerId === ownerId);
  const strategyData =
    strategyBucket === 'INTRADAY' ? selectedOwner?.intraday : selectedOwner?.swing;

  const availableProfit = strategyData?.availableProfitForWithdrawal ?? 0;
  const contributedCapital = strategyData?.contributedCapital ?? 0;
  const availableForType = withdrawalType === 'PROFIT' ? availableProfit : contributedCapital;

  const numAmount = parseFloat(amount);
  const isValidAmount = !isNaN(numAmount) && numAmount > 0;
  const exceedsLimit = isValidAmount && numAmount > availableForType;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (exceedsLimit && withdrawalType === 'PROFIT') {
      setError(`Cannot withdraw more than available profit (${formatINR(availableProfit)}).`);
      return;
    }
    setError('');
    setConfirmOpen(true);
  };

  const handleConfirm = async (withOverride = false) => {
    setLoading(true);
    setError('');
    setSuccess('');
    setConfirmOpen(false);
    setOverrideConfirm(false);

    try {
      const idempotencyKey = `wd-${ownerId}-${strategyBucket}-${withdrawalType}-${Date.now()}`;
      const body: Record<string, unknown> = {
        portfolioOwnerId: ownerId,
        strategyBucket,
        withdrawalType,
        amount: numAmount,
        txDate,
        notes: notes || undefined,
        idempotencyKey,
      };

      if (withOverride) {
        body.overrideCapitalLimit = true;
        body.overrideReason = overrideReason;
      }

      const res = await fetch('/api/capital/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to record withdrawal.');
      }

      setSuccess(
        `${withdrawalType === 'PROFIT' ? 'Profit' : 'Capital'} withdrawal of ${formatINR(numAmount)} recorded successfully.`
      );
      setAmount('');
      setNotes('');
      setOverrideReason('');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-base text-[var(--foreground)]">Record Withdrawal</h2>
          <button onClick={onClose} className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Portfolio Owner */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Portfolio Owner</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {owners.map((o) => (
                <option key={o.portfolioOwnerId} value={o.portfolioOwnerId}>
                  {o.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Strategy</label>
            <div className="grid grid-cols-2 gap-2">
              {(['INTRADAY', 'SWING'] as StrategyBucket[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStrategyBucket(s)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    strategyBucket === s
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] hover:border-blue-400'
                  }`}
                >
                  {s === 'INTRADAY' ? 'Intraday (MIS)' : 'Swing (CNC)'}
                </button>
              ))}
            </div>
          </div>

          {/* Withdrawal type */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Withdrawal Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['PROFIT', 'CAPITAL'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setWithdrawalType(type); setAmount(''); setError(''); }}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    withdrawalType === type
                      ? type === 'PROFIT'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-[var(--background)] border-[var(--border)] text-[var(--foreground)] hover:border-blue-400'
                  }`}
                >
                  {type === 'PROFIT' ? '💰 Profit' : '🏦 Capital'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--muted)] mt-1.5">
              {withdrawalType === 'PROFIT'
                ? 'Withdraws from realized trading profits. Does not affect contributed capital.'
                : 'Withdraws from contributed capital. Does not affect net realized P&L.'}
            </p>
          </div>

          {/* Available balance */}
          <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-3 space-y-1.5 text-xs">
            {withdrawalType === 'PROFIT' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Net Realized P&amp;L</span>
                  <span className="font-semibold tabular-nums">{formatINR(strategyData?.cumulativeNetRealizedPnl ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Already Withdrawn</span>
                  <span className="font-semibold tabular-nums text-amber-500">
                    -{formatINR(strategyData?.cumulativeProfitWithdrawals ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--border)] pt-1.5 mt-0.5">
                  <span className="font-semibold text-[var(--foreground)]">Available for Withdrawal</span>
                  <span className="font-bold tabular-nums text-emerald-500">{formatINR(availableProfit)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Contributed Capital</span>
                  <span className="font-semibold tabular-nums">{formatINR(contributedCapital)}</span>
                </div>
                <p className="text-[var(--muted)] text-[10px] mt-1">
                  Withdrawing reduces contributed capital. Current capital will decrease by the same amount.
                </p>
              </>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Amount (₹)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
              placeholder={withdrawalType === 'PROFIT' ? `Max: ${formatINR(availableProfit)}` : 'Amount'}
              className={`w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 tabular-nums ${
                exceedsLimit && withdrawalType === 'PROFIT' ? 'border-rose-500' : 'border-[var(--border)]'
              }`}
              required
            />
            {exceedsLimit && withdrawalType === 'PROFIT' && (
              <p className="text-xs text-rose-500 mt-1">
                Exceeds available profit ({formatINR(availableProfit)}).
              </p>
            )}
            {exceedsLimit && withdrawalType === 'CAPITAL' && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Exceeds contributed capital ({formatINR(contributedCapital)}). Admin override required.
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Transaction Date</label>
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Monthly profit booking"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !isValidAmount || (exceedsLimit && withdrawalType === 'PROFIT')}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
          >
            {loading ? 'Processing…' : 'Review & Confirm'}
          </button>
        </form>

        {/* Normal confirmation */}
        {confirmOpen && !exceedsLimit && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 shadow-2xl space-y-4">
              <h3 className="font-bold text-base text-[var(--foreground)]">Confirm Withdrawal</h3>
              <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-[var(--muted)]">Owner</span><span className="font-semibold">{selectedOwner?.displayName}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Strategy</span><span className="font-semibold">{strategyBucket === 'INTRADAY' ? 'Intraday (MIS)' : 'Swing (CNC)'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Type</span><span className="font-semibold">{withdrawalType === 'PROFIT' ? 'Profit Withdrawal' : 'Capital Withdrawal'}</span></div>
                <div className="flex justify-between border-t border-[var(--border)] pt-2 mt-1">
                  <span className="font-semibold">Amount</span>
                  <span className="font-bold text-amber-500 tabular-nums">{formatINR(numAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Date</span>
                  <span className="font-semibold">{txDate}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)] transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleConfirm(false)} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {loading ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Capital override confirmation */}
        {confirmOpen && exceedsLimit && withdrawalType === 'CAPITAL' && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm bg-[var(--card)] rounded-2xl border border-amber-500/50 p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-base">Override Capital Limit</h3>
              </div>
              <p className="text-xs text-[var(--muted)]">
                The withdrawal of <strong>{formatINR(numAmount)}</strong> exceeds the contributed capital of <strong>{formatINR(contributedCapital)}</strong>. Admin override required.
              </p>
              <div>
                <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Override Reason (required)</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={2}
                  placeholder="Explain why this override is necessary"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirm(true)}
                  disabled={loading || !overrideReason.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing…' : 'Override & Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
