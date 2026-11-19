'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, AlertCircle, Heart } from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { useUser } from '@/components/providers/UserContext';
import { toast } from 'sonner';

interface SetInitialCapitalModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  husbandInitial?: number;
  wifeInitial?: number;
  husbandId?: string;
  wifeId?: string;
}

export function SetInitialCapitalModal({
  open,
  onClose,
  onSuccess,
  husbandInitial = 0,
  wifeInitial = 0,
  husbandId,
  wifeId,
}: SetInitialCapitalModalProps) {
  const { persons, householdId } = useUser();

  const husband = persons.find(
    (p) =>
      p.relationshipLabel.toLowerCase().includes('husband') ||
      p.displayName.toLowerCase().includes('husband') ||
      p.relationshipLabel.toLowerCase().includes('self')
  ) || persons[0];

  const wife = persons.find(
    (p) =>
      p.relationshipLabel.toLowerCase().includes('wife') ||
      p.displayName.toLowerCase().includes('wife') ||
      p.relationshipLabel.toLowerCase().includes('spouse')
  ) || persons[1];

  const [husbandAmount, setHusbandAmount] = useState(husbandInitial > 0 ? String(husbandInitial) : '');
  const [wifeAmount, setWifeAmount] = useState(wifeInitial > 0 ? String(wifeInitial) : '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setHusbandAmount(husbandInitial > 0 ? String(husbandInitial) : '');
      setWifeAmount(wifeInitial > 0 ? String(wifeInitial) : '');
      setError('');
    }
  }, [open, husbandInitial, wifeInitial]);

  if (!open) return null;

  const hNum = parseFloat(husbandAmount) || 0;
  const wNum = parseFloat(wifeAmount) || 0;
  // Automatically calculate combined initial capital (non-editable)
  const combinedTotal = hNum + wNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hNum < 0 || wNum < 0) {
      setError('Capital amounts cannot be negative.');
      return;
    }
    if (husbandAmount === '' && wifeAmount === '') {
      setError('Please enter an initial capital amount for Husband or Wife.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const targetHusbandId = husbandId || husband?.id;
      const targetWifeId = wifeId || wife?.id;

      const allocations: { portfolioOwnerId: string; amount: number; notes: string }[] = [];

      if (targetHusbandId && husbandAmount !== '') {
        allocations.push({
          portfolioOwnerId: targetHusbandId,
          amount: hNum,
          notes: notes || 'Initial capital allocation for Husband',
        });
      }

      if (targetWifeId && wifeAmount !== '') {
        allocations.push({
          portfolioOwnerId: targetWifeId,
          amount: wNum,
          notes: notes || 'Initial capital allocation for Wife',
        });
      }

      const res = await fetch('/api/capital/initial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to set initial capital');
      }

      toast.success('Initial invested capital set successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl overflow-hidden p-6 space-y-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center animate-soft-glow">
              <Heart className="w-4 h-4 fill-current animate-heart-beat" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Set Initial Invested Capital</h3>
              <p className="text-xs text-[var(--muted)]">Set separate starting capital for Husband and Wife</p>
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
          {/* Husband initial capital */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
              <span>Husband's Initial Capital (₹)</span>
              {hNum > 0 && <span className="text-[11px] font-mono text-rose-500">{formatINR(hNum)}</span>}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 500000"
              value={husbandAmount}
              onChange={(e) => setHusbandAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-sm font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          {/* Wife initial capital */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)] flex items-center justify-between">
              <span>Wife's Initial Capital (₹)</span>
              {wNum > 0 && <span className="text-[11px] font-mono text-rose-500">{formatINR(wNum)}</span>}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 500000"
              value={wifeAmount}
              onChange={(e) => setWifeAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-sm font-mono text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          {/* Combined initial capital: automatically calculated, non-editable */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/5 via-champagne-500/5 to-lavender-500/5 border border-rose-500/20 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                Combined Initial Capital (Automatic)
              </p>
              <p className="text-xs text-[var(--muted)]">Calculated automatically • Non-editable</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400">
                {formatINR(combinedTotal)}
              </span>
            </div>
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--muted)]">Optional Note</label>
            <input
              type="text"
              placeholder="e.g. Initial deposit from joint savings"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>

          {/* Buttons */}
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
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Initial Capital'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
