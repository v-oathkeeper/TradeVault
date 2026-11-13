'use client';

import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import type { StrategyBucket, OwnerCapitalSummary } from '@/types/capital';

type TxOperation = 'INITIAL_ALLOCATION' | 'CAPITAL_CONTRIBUTION' | 'CAPITAL_ADJUSTMENT';

interface ManageCapitalModalProps {
  open: boolean;
  owners: OwnerCapitalSummary[];
  initialOwnerId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ManageCapitalModal({
  open,
  owners,
  initialOwnerId,
  onClose,
  onSuccess,
}: ManageCapitalModalProps) {
  const today = new Date().toISOString().split('T')[0];

  const [ownerId, setOwnerId] = useState(initialOwnerId ?? owners[0]?.portfolioOwnerId ?? '');
  const [strategyBucket, setStrategyBucket] = useState<StrategyBucket>('INTRADAY');
  const [operation, setOperation] = useState<TxOperation>('INITIAL_ALLOCATION');
  const [amount, setAmount] = useState('');
  const [txDate, setTxDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!open) return null;

  const selectedOwner = owners.find((o) => o.portfolioOwnerId === ownerId);
  const currentStrategyData =
    strategyBucket === 'INTRADAY' ? selectedOwner?.intraday : selectedOwner?.swing;
  const currentContributed = currentStrategyData?.contributedCapital ?? 0;

  const numAmount = parseFloat(amount);
  const isValidAmount = !isNaN(numAmount) && numAmount > 0;

  // For CAPITAL_ADJUSTMENT: compute old → new → diff
  const newContributed =
    operation === 'CAPITAL_ADJUSTMENT' && isValidAmount
      ? numAmount // user enters the new total
      : null;
  const adjustmentDiff =
    operation === 'CAPITAL_ADJUSTMENT' && newContributed != null
      ? newContributed - currentContributed
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) {
      setError('Please enter a valid positive amount.');
      return;
    }
    setError('');
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setConfirmOpen(false);

    try {
      const idempotencyKey = `cap-${ownerId}-${strategyBucket}-${operation}-${Date.now()}`;
      const body: Record<string, unknown> = {
        portfolioOwnerId: ownerId,
        strategyBucket,
        txType: operation,
        amount: operation === 'CAPITAL_ADJUSTMENT' ? Math.abs(adjustmentDiff!) : numAmount,
        txDate,
        notes: notes || undefined,
        idempotencyKey,
      };

      if (operation === 'CAPITAL_ADJUSTMENT') {
        body.previousAmount = currentContributed;
        body.newAmount = newContributed;
        // For adjustment, the amount is the absolute diff
        body.amount = Math.abs(adjustmentDiff!);
      }

      const res = await fetch('/api/capital/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save transaction.');
      }

      setSuccess(
        operation === 'INITIAL_ALLOCATION'
          ? `Initial allocation of ${formatINR(numAmount)} recorded.`
          : operation === 'CAPITAL_CONTRIBUTION'
          ? `Capital contribution of ${formatINR(numAmount)} recorded.`
          : `Capital adjusted to ${formatINR(newContributed!)} (Δ ${adjustmentDiff! >= 0 ? '+' : ''}${formatINR(adjustmentDiff!)}).`
      );
      setAmount('');
      setNotes('');
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

  const operationLabel: Record<TxOperation, string> = {
    INITIAL_ALLOCATION: 'Initial Allocation',
    CAPITAL_CONTRIBUTION: 'Additional Contribution',
    CAPITAL_ADJUSTMENT: 'Capital Adjustment',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="font-bold text-base text-[var(--foreground)]">Manage Capital</h2>
          <button onClick={onClose} className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
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

          {/* Operation */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">Operation</label>
            <select
              value={operation}
              onChange={(e) => { setOperation(e.target.value as TxOperation); setAmount(''); }}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="INITIAL_ALLOCATION">Initial Allocation</option>
              <option value="CAPITAL_CONTRIBUTION">Additional Contribution</option>
              <option value="CAPITAL_ADJUSTMENT">Capital Adjustment (set new total)</option>
            </select>
          </div>

          {/* Current balance context */}
          <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Current Contributed Capital</span>
              <span className="font-semibold tabular-nums">{formatINR(currentContributed)}</span>
            </div>
            {operation === 'CAPITAL_ADJUSTMENT' && isValidAmount && adjustmentDiff != null && (
              <>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">New Amount (you enter)</span>
                  <span className="font-semibold tabular-nums">{formatINR(numAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1">
                  <span className="text-[var(--muted)]">Adjustment Diff</span>
                  <span className={`font-bold tabular-nums ${adjustmentDiff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {adjustmentDiff >= 0 ? '+' : ''}{formatINR(adjustmentDiff)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
              {operation === 'CAPITAL_ADJUSTMENT' ? 'New Total Contributed Capital (₹)' : 'Amount (₹)'}
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 20000"
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 tabular-nums"
              required
            />
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
            <label className="block text-xs font-semibold text-[var(--muted)] mb-1.5">
              Notes / Reason {operation === 'CAPITAL_ADJUSTMENT' && <span className="text-rose-400">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={operation === 'CAPITAL_ADJUSTMENT' ? 'Reason for adjustment (required for audit)' : 'Optional notes'}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              required={operation === 'CAPITAL_ADJUSTMENT'}
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
            disabled={loading || !isValidAmount}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
          >
            {loading ? 'Saving…' : 'Review & Confirm'}
          </button>
        </form>

        {/* Confirmation dialog */}
        {confirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm bg-[var(--card)] rounded-2xl border border-[var(--border)] p-5 shadow-2xl space-y-4">
              <h3 className="font-bold text-base text-[var(--foreground)]">Confirm Capital Transaction</h3>
              <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-[var(--muted)]">Owner</span><span className="font-semibold">{selectedOwner?.displayName}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Strategy</span><span className="font-semibold">{strategyBucket === 'INTRADAY' ? 'Intraday (MIS)' : 'Swing (CNC)'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Operation</span><span className="font-semibold">{operationLabel[operation]}</span></div>
                {operation === 'CAPITAL_ADJUSTMENT' ? (
                  <>
                    <div className="flex justify-between"><span className="text-[var(--muted)]">Old Amount</span><span className="font-semibold tabular-nums">{formatINR(currentContributed)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--muted)]">New Amount</span><span className="font-semibold tabular-nums">{formatINR(newContributed!)}</span></div>
                    <div className="flex justify-between border-t border-[var(--border)] pt-2 mt-1">
                      <span className="text-[var(--muted)]">Difference</span>
                      <span className={`font-bold tabular-nums ${adjustmentDiff! >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {adjustmentDiff! >= 0 ? '+' : ''}{formatINR(adjustmentDiff!)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between"><span className="text-[var(--muted)]">Amount</span><span className="font-bold tabular-nums text-emerald-500">+{formatINR(numAmount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-[var(--muted)]">Date</span><span className="font-semibold">{txDate}</span></div>
                {notes && <div className="flex justify-between gap-2"><span className="text-[var(--muted)] shrink-0">Notes</span><span className="font-medium text-right">{notes}</span></div>}
              </div>
              <p className="text-xs text-[var(--muted)]">
                This creates an auditable capital transaction record. Historical records cannot be silently deleted.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)] transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {loading ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
