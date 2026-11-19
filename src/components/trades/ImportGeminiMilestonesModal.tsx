'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Shield,
  Clock,
  ArrowRight,
  ClipboardPaste,
  FileCode,
} from 'lucide-react';
import { formatINR } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { MilestonePreviewResult } from '@/lib/services/gemini-milestone-service';
import { LottieAnimation } from '@/components/ui/LottieAnimation';
import { successCheckAnimation } from '@/lib/animations/lottie-data';

interface ImportGeminiMilestonesModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedTradeId?: string;
  preselectedSymbol?: string;
  availableTrades?: { id: string; symbol: string; entryPrice: number; status: string }[];
}

const EXAMPLE_GEMINI_JSON = `{
  "schema_version": "1.0",
  "source": "gemini_trading_skill",
  "updated_at": "2026-11-19T15:10:00+05:30",
  "portfolio_owner": "me",
  "broker": "ZERODHA",
  "exchange": "NSE",
  "symbol": "PPLPHARMA",
  "trade_type": "SWING",
  "direction": "LONG",
  "entry_price": 239.94,
  "initial_stop_loss": 230.50,
  "quantity": 30,
  "strategy": "Swing",
  "milestones": {
    "milestone_1": {
      "target_price": 254.10,
      "status": "PENDING",
      "trailing_stop_loss": 241.00
    },
    "milestone_2": {
      "target_price": 258.85,
      "status": "PENDING",
      "trailing_stop_loss": 254.10
    },
    "milestone_3": {
      "target_price": 266.40,
      "status": "PENDING",
      "trailing_stop_loss": 258.85
    }
  },
  "last_reached_milestone": null,
  "current_trailing_stop_loss": null,
  "notes": "Filled 30 shares at 239.94 (15:08:41 IST). On M1 (254.10), trail stop to SL2 Estimated Net Breakeven (241.00); on M2 (258.85), trail stop to SL3 (254.10); M3 target at 266.40."
}`;

export function ImportGeminiMilestonesModal({
  open,
  onClose,
  onSuccess,
  preselectedTradeId,
  preselectedSymbol,
  availableTrades = [],
}: ImportGeminiMilestonesModalProps) {
  const queryClient = useQueryClient();

  const [jsonText, setJsonText] = useState('');
  const [selectedTradeId, setSelectedTradeId] = useState(preselectedTradeId || '');
  const [preview, setPreview] = useState<MilestonePreviewResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCreatingTrade, setIsCreatingTrade] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (preselectedTradeId) setSelectedTradeId(preselectedTradeId);
      setError('');
    }
  }, [open, preselectedTradeId]);

  if (!open) return null;

  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setJsonText(text);
          setPreview(null);
          toast.success('Pasted JSON from clipboard');
        } else {
          toast.info('Clipboard is empty');
        }
      }
    } catch {
      toast.error('Could not access clipboard. Please paste directly into the box.');
    }
  };

  const handleLoadExample = () => {
    setJsonText(EXAMPLE_GEMINI_JSON);
    setPreview(null);
    toast.info('Loaded example Gemini milestone JSON');
  };

  const handleValidate = async () => {
    if (!jsonText.trim()) {
      setError('Please paste Gemini output JSON first.');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const res = await fetch('/api/trades/milestones/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonText,
          tradeId: selectedTradeId || undefined,
        }),
      });

      const data: MilestonePreviewResult = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Validation failed');
      }

      setPreview(data);
      if (data.matchedTrade && !selectedTradeId) {
        setSelectedTradeId(data.matchedTrade.id);
      }
      toast.success('Gemini milestone output validated successfully!');
    } catch (err) {
      setError((err as Error).message);
      setPreview(null);
    } finally {
      setIsValidating(false);
    }
  };

  const handleCreateNewTrade = async () => {
    if (!jsonText.trim()) {
      setError('Please provide JSON trade text.');
      return;
    }

    setIsCreatingTrade(true);
    setError('');

    try {
      const res = await fetch('/api/trades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import new trade');
      }

      toast.success(
        `Trade ${preview?.milestones?.symbol || ''} created with Gemini milestones & trailing stops!`
      );

      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['capital-summary'] });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreatingTrade(false);
    }
  };

  const handleApply = async () => {
    const tradeIdToApply = selectedTradeId || preview?.matchedTrade?.id;
    if (!tradeIdToApply) {
      setError('Please select or specify a target trade.');
      return;
    }
    if (!preview?.milestones) {
      setError('Please validate the JSON first before importing.');
      return;
    }

    setIsApplying(true);
    setError('');

    try {
      const res = await fetch(`/api/trades/${tradeIdToApply}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestones: preview.milestones,
          jsonText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to apply milestones');
      }

      toast.success('Gemini milestones & trailing stop-loss applied successfully!');

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trade', tradeIdToApply] });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsApplying(false);
    }
  };

  const m = preview?.milestones;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-rose-500 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--foreground)]">Import Gemini Milestones</h3>
              <p className="text-xs text-[var(--muted)]">
                Import targets and dynamic trailing stop-loss values from your Gemini skill
              </p>
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
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--foreground)]">Gemini JSON Output</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste</span>
              </button>
              <span className="text-[var(--border)]">•</span>
              <button
                type="button"
                onClick={handleLoadExample}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Example</span>
              </button>
            </div>
          </div>

          <textarea
            rows={7}
            placeholder={`Paste Gemini JSON here...\n{\n  "schema_version": "1.0",\n  "source": "gemini_trading_skill",\n  "portfolio_owner": "me",\n  "broker": "ZERODHA",\n  "symbol": "PPLPHARMA",\n  "trade_type": "SWING",\n  "direction": "LONG",\n  "entry_price": 239.94,\n  "initial_stop_loss": 230.50,\n  "quantity": 30,\n  "milestones": {\n    "milestone_1": { "target_price": 254.10, "status": "PENDING", "trailing_stop_loss": 241.00 },\n    "milestone_2": { "target_price": 258.85, "status": "PENDING", "trailing_stop_loss": 254.10 },\n    "milestone_3": { "target_price": 266.40, "status": "PENDING", "trailing_stop_loss": 258.85 }\n  },\n  "current_trailing_stop_loss": null\n}`}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setPreview(null);
            }}
            className="w-full p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-y"
          />

          {/* Target trade selector if not preselected */}
          {availableTrades.length > 0 && !preselectedTradeId && (
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-semibold text-[var(--muted)]">Target Trade (Optional override)</label>
              <select
                value={selectedTradeId}
                onChange={(e) => setSelectedTradeId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-2xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                <option value="">Auto-detect from JSON symbol / ID</option>
                {availableTrades.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.symbol} ({t.status}) — Entry: ₹{t.entryPrice}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleValidate}
              disabled={isValidating || !jsonText.trim()}
              className="px-4 py-2 rounded-2xl bg-[var(--background)] hover:bg-[var(--card)] border border-[var(--border)] text-xs font-semibold text-[var(--foreground)] transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>{isValidating ? 'Validating...' : 'Validate & Preview'}</span>
            </button>
          </div>
        </div>

        {/* ── Structured Preview ────────────────────────────────────── */}
        {preview && m && (
          <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-champagne-500/5 to-lavender-500/5 p-4 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <LottieAnimation animationData={successCheckAnimation} loop={false} className="w-8 h-8 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-[var(--foreground)] block">Validated Preview</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Ready for import</span>
                </div>
              </div>
              {preview.matchedTrade ? (
                <div className="text-xs">
                  <span className="text-[var(--muted)]">Target Trade: </span>
                  <span className="font-bold font-mono text-rose-500">{preview.matchedTrade.symbol}</span>
                  <span className="text-[var(--muted)]"> ({preview.matchedTrade.ownerName})</span>
                </div>
              ) : (
                <div className="text-right">
                  <span className="text-xs text-amber-500 font-semibold block">
                    ⚠️ No exact matching trade found automatically.
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    Select one above or import as a new trade below.
                  </span>
                </div>
              )}
            </div>

            {/* Trade Details Grid (Owner, Broker, Direction, Entry Price × Qty, Initial SL) */}
            {preview.tradeDetails && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-xs">
                <div>
                  <span className="text-[10px] text-[var(--muted)] block">Portfolio Owner</span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {preview.tradeDetails.portfolioOwner.toLowerCase() === 'me' || preview.tradeDetails.portfolioOwner.toLowerCase() === 'husband'
                      ? 'Husband (Admin)'
                      : preview.tradeDetails.portfolioOwner.toLowerCase() === 'spouse' || preview.tradeDetails.portfolioOwner.toLowerCase() === 'wife'
                      ? 'Wife (Viewer)'
                      : preview.tradeDetails.portfolioOwner}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] block">Broker & Product</span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {preview.tradeDetails.broker} • {preview.tradeDetails.tradeType}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] block">Entry Price × Qty</span>
                  <span className="font-mono font-semibold text-[var(--foreground)]">
                    {preview.tradeDetails.entryPrice ? formatINR(preview.tradeDetails.entryPrice) : '—'} × {preview.tradeDetails.quantity ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] block">Initial Stop-Loss</span>
                  <span className="font-mono font-semibold text-rose-400">
                    {preview.tradeDetails.initialStopLoss ? formatINR(preview.tradeDetails.initialStopLoss) : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* Milestones 1, 2, 3 Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { title: 'Milestone 1', item: m.milestone1, delay: 'stagger-1' },
                { title: 'Milestone 2', item: m.milestone2, delay: 'stagger-2' },
                { title: 'Milestone 3', item: m.milestone3, delay: 'stagger-3' },
              ].map(({ title, item, delay }, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-1.5 card-hover animate-slide-up ${delay}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      {title}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'REACHED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : item.status === 'MISSED'
                          ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-blue-500/10 text-blue-500'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Target Price</span>
                    <span className="text-sm font-bold font-mono text-[var(--foreground)]">
                      {item.targetPrice != null ? formatINR(item.targetPrice) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Trailing Stop-Loss</span>
                    <span className="text-xs font-mono font-semibold text-rose-400">
                      {item.trailingStopLoss != null ? formatINR(item.trailingStopLoss) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Trailing Stop Loss & Last Reached */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                    Active Trailing Stop-Loss
                  </span>
                  <span className="text-sm font-bold font-mono text-rose-500">
                    {m.currentTrailingStopLoss != null ? formatINR(m.currentTrailingStopLoss) : 'Not specified'}
                  </span>
                </div>
                <Shield className="w-5 h-5 text-rose-500/50" />
              </div>

              <div className="p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                    Last Reached Milestone
                  </span>
                  <span className="text-sm font-bold text-[var(--foreground)]">
                    {m.lastReachedMilestone || 'None'}
                  </span>
                </div>
                <TrendingUp className="w-5 h-5 text-purple-500/50" />
              </div>
            </div>

            {m.notes && (
              <p className="text-xs text-[var(--muted)] italic pt-1">
                Note: &ldquo;{m.notes}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying || isCreatingTrade}
            className="px-4 py-2.5 rounded-2xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--background)] transition-colors"
          >
            Cancel
          </button>

          {/* Option A: Import as brand new trade with milestones (available when entry price & quantity exist) */}
          {preview?.tradeDetails?.entryPrice != null && (
            <button
              type="button"
              onClick={handleCreateNewTrade}
              disabled={isCreatingTrade || isApplying}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isCreatingTrade ? 'Importing Trade...' : 'Import as New Trade'}</span>
            </button>
          )}

          {/* Option B: Apply milestones to existing trade (when matched or selected) */}
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying || isCreatingTrade || !preview?.milestones || (!selectedTradeId && !preview?.matchedTrade)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-600 hover:from-rose-600 hover:to-purple-700 text-white font-semibold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isApplying ? 'Applying...' : 'Apply to Existing Trade'}
          </button>
        </div>
      </div>
    </div>
  );
}
