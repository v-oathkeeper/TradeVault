'use client';

import React, { useState, useEffect } from 'react';
import { X, ArrowDownCircle, AlertCircle, User, ShieldAlert, Coins, Wallet } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { useUser } from '@/components/providers/UserContext';
import { toast } from 'sonner';
import type { HouseholdCapitalSummary } from '@/types/capital';

interface WithdrawMoneyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  summary?: HouseholdCapitalSummary;
  preselectedOwnerId?: string;
  defaultWithdrawalType?: 'PROFIT' | 'CAPITAL';
}

export function WithdrawMoneyModal({
  open,
  onClose,
  onSuccess,
  summary,
  preselectedOwnerId,
  defaultWithdrawalType = 'PROFIT',
}: WithdrawMoneyModalProps) {
  const { persons } = useUser();
  const today = new Date().toISOString().split('T')[0];

  const [withdrawalType, setWithdrawalType] = useState<'PROFIT' | 'CAPITAL'>(defaultWithdrawalType);
  const [ownerId, setOwnerId] = useState(preselectedOwnerId || persons[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [txDate, setTxDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setWithdrawalType(defaultWithdrawalType);
      if (preselectedOwnerId) setOwnerId(preselectedOwnerId);
      else if (persons[0]?.id) setOwnerId(persons[0].id);
      setAmount('');
      setNotes('');
      setError('');
    }
  }, [open, preselectedOwnerId, defaultWithdrawalType, persons]);

  if (!open) return null;

  const selectedOwner = summary?.owners.find((o) => o.portfolioOwnerId === ownerId);

  // Invariants:
  // Available Profit = Max(0, allTimeProfit - previousProfitWithdrawals)
  const availableProfit = selectedOwner?.availableProfit ?? 0;
  // Invested Capital = Initial + Contributions - Capital Withdrawals
  const investedCapital = selectedOwner?.investedCapital ?? 0;

  const limitForCurrentType = withdrawalType === 'PROFIT' ? availableProfit : investedCapital;
  const numAmount = parseFloat(amount) || 0;
  const exceedsLimit = numAmount > limitForCurrentType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Please enter a valid positive withdrawal amount.');
      return;
    }
    if (withdrawalType === 'PROFIT' && numAmount > availableProfit) {
      setError(`Cannot withdraw more than available profit (${formatINR(availableProfit)}).`);
      return;
    }
    if (withdrawalType === 'CAPITAL' && numAmount > investedCapital) {
      setError(`Cannot withdraw more than current invested capital (${formatINR(investedCapital)}).`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const idempotencyKey = `wd-${ownerId}-${withdrawalType}-${Date.now()}`;
      const res = await fetch('/api/capital/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioOwnerId: ownerId,
          strategyBucket: 'INTRADAY',
          withdrawalType,
          amount: numAmount,
          txDate,
          notes: notes || (withdrawalType === 'PROFIT' ? 'Profit withdrawal' : 'Capital withdrawal'),
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record withdrawal');
      }

      toast.success(
        `Successfully recorded ${withdrawalType === 'PROFIT' ? 'profit' : 'capital'} withdrawal of ${formatINR(numAmount)}!`
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Withdraw Money</h3>
              <p className="text-xs text-[var(--muted)]">Withdraw from trading profit or invested capital</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Withdrawal Type Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              setWithdrawalType('PROFIT');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              withdrawalType === 'PROFIT'
                ? 'bg-[var(--card)] text-amber-500 shadow-sm border border-[var(--border)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Withdraw from Profit</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setWithdrawalType('CAPITAL');
              setError('');
            }}
            className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              withdrawalType === 'CAPITAL'
                ? 'bg-[var(--card)] text-rose-500 shadow-sm border border-[var(--border)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Withdraw from Invested Capital</span>
          </button>
        </div>

        {/* Context description banner */}
        <div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted)] space-y-1">
          {withdrawalType === 'PROFIT' ? (
            <p>
              <strong className="text-[var(--foreground)]">Profit Withdrawal:</strong> Deducts from available profit. Does <strong>not</strong> reduce invested capital or lifetime profit.
            </p>
          ) : (
            <p>
              <strong className="text-[var(--foreground)]">Capital Withdrawal:</strong> Reduces invested capital. Does <strong>not</strong> modify trading profit or count as a trading loss.
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Owner Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Select Account Owner</label>
            <div className="grid grid-cols-2 gap-2">
              {persons.map((person) => {
                const isSelected = ownerId === person.id;
                const pSummary = summary?.owners.find((o) => o.portfolioOwnerId === person.id);
                const pAvailable = withdrawalType === 'PROFIT' ? (pSummary?.availableProfit ?? 0) : (pSummary?.investedCapital ?? 0);

                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      setOwnerId(person.id);
                      setError('');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 shadow-sm'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <User className="w-3.5 h-3.5" />
                      <span>{person.relationshipLabel || person.displayName}</span>
                    </div>
                    <div className="mt-1 text-[11px] font-mono opacity-80">
                      Avail: {formatINR(pAvailable)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Available limit banner */}
          <div className="p-3 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-amber-500/5 to-rose-500/5 flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">
              {withdrawalType === 'PROFIT' ? 'Available Profit for Withdrawal:' : 'Current Invested Capital:'}
            </span>
            <span className="font-bold font-mono text-sm text-[var(--foreground)]">
              {formatINR(limitForCurrentType)}
            </span>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--foreground)]">
              <span>Withdrawal Amount (₹)</span>
              {numAmount > 0 && (
                <span className={`text-[11px] font-mono ${exceedsLimit ? 'text-rose-500' : 'text-amber-500'}`}>
                  {formatINR(numAmount)}
                </span>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="1"
              max={limitForCurrentType}
              required
              placeholder="e.g. 10000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-2xl bg-[var(--background)] border text-sm font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 ${
                exceedsLimit
                  ? 'border-rose-500 focus:ring-rose-500/30'
                  : 'border-[var(--border)] focus:ring-amber-500/30'
              }`}
            />
            {exceedsLimit && (
              <p className="text-[11px] text-rose-500 mt-1">
                Amount exceeds available {withdrawalType === 'PROFIT' ? 'profit' : 'invested capital'} ({formatINR(limitForCurrentType)}).
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">Transaction Date</label>
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">Optional Note</label>
            <input
              type="text"
              placeholder="e.g. Transferred profit to personal savings"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-2xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--background)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || exceedsLimit || numAmount <= 0}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Recording...' : 'Record Withdrawal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
