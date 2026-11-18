'use client';

import React, { useState } from 'react';
import { X, PlusCircle, AlertCircle, User, ArrowUpCircle } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { useUser } from '@/components/providers/UserContext';
import { toast } from 'sonner';

interface AddMoneyModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedOwnerId?: string;
}

export function AddMoneyModal({
  open,
  onClose,
  onSuccess,
  preselectedOwnerId,
}: AddMoneyModalProps) {
  const { persons } = useUser();
  const today = new Date().toISOString().split('T')[0];

  const [ownerId, setOwnerId] = useState(preselectedOwnerId || persons[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [txDate, setTxDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (open) {
      if (preselectedOwnerId) setOwnerId(preselectedOwnerId);
      else if (persons[0]?.id) setOwnerId(persons[0].id);
      setAmount('');
      setNotes('');
      setError('');
    }
  }, [open, preselectedOwnerId, persons]);

  if (!open) return null;

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    if (!ownerId) {
      setError('Please select Husband or Wife.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const idempotencyKey = `add-${ownerId}-${Date.now()}`;
      const res = await fetch('/api/capital/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioOwnerId: ownerId,
          strategyBucket: 'INTRADAY',
          txType: 'CAPITAL_CONTRIBUTION',
          amount: numAmount,
          txDate,
          notes: notes || 'Additional capital addition',
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add money');
      }

      toast.success(`Successfully added ${formatINR(numAmount)} to capital!`);
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
      <div className="w-full max-w-md rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Add Money</h3>
              <p className="text-xs text-[var(--muted)]">Deposit capital to increase invested capital</p>
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

        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Owner selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">Select Account Owner</label>
            <div className="grid grid-cols-2 gap-2">
              {persons.map((person) => {
                const isSelected = ownerId === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setOwnerId(person.id)}
                    className={`py-2.5 px-3 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{person.relationshipLabel || person.displayName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
              <span>Amount (₹)</span>
              {numAmount > 0 && <span className="text-[11px] font-mono text-emerald-500">{formatINR(numAmount)}</span>}
            </label>
            <input
              type="number"
              step="any"
              min="1"
              required
              placeholder="e.g. 50000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-sm font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">Transaction Date</label>
            <input
              type="date"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">Optional Note</label>
            <input
              type="text"
              placeholder="e.g. Monthly salary savings deposit"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Actions */}
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
              disabled={loading}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Money'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
