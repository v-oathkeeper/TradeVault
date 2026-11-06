'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  UploadCloud,
  ClipboardPaste,
  FileCode,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatINR, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type {
  ImportValidationResult,
  ValidatedTradeItem,
} from '@/lib/validation/import-schema';

interface ImportTradeModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EXAMPLE_JSON = `{
  "schema_version": "1.0",
  "trades": [
    {
      "portfolio_owner": "me",
      "broker": "ZERODHA",
      "exchange": "NSE",
      "symbol": "UNIONBANK",
      "trade_type": "SWING",
      "direction": "LONG",
      "entry_price": 182.45,
      "initial_stop_loss": 175.50,
      "quantity": 10,
      "target_price": 203.30,
      "strategy": "Breakout",
      "notes": "Breakout above resistance with volume confirmation"
    }
  ]
}`;

export function ImportTradeModal({ open, onClose, onSuccess }: ImportTradeModalProps) {
  const router = useRouter();

  const [jsonText, setJsonText] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ImportValidationResult | null>(null);
  const [importSummary, setImportSummary] = useState<{
    importedCount: number;
    tradeIds: string[];
    successful: { index: number; symbol: string; id: string }[];
  } | null>(null);

  if (!open) return null;

  // Paste action from clipboard
  const handlePasteClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setJsonText(text);
          setValidationResult(null);
          toast.success('Pasted JSON from clipboard');
        } else {
          toast.info('Clipboard is empty');
        }
      } else {
        toast.error('Clipboard access not supported. Please paste directly into the box.');
      }
    } catch {
      toast.error('Could not access clipboard', {
        description: 'Please paste directly into the textarea.',
      });
    }
  };

  // Load example JSON
  const handleLoadExample = () => {
    setJsonText(EXAMPLE_JSON);
    setValidationResult(null);
    toast.info('Loaded example JSON template');
  };

  // Clear input and validation state
  const handleClear = () => {
    setJsonText('');
    setValidationResult(null);
    setImportSummary(null);
  };

  // Validate JSON action
  const handleValidate = async () => {
    if (!jsonText.trim()) {
      toast.error('Please paste or enter JSON content to validate');
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const res = await fetch('/api/trades/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonText }),
      });

      const data: ImportValidationResult = await res.json();

      if (!res.ok) {
        if (data.globalErrors && data.globalErrors.length > 0) {
          setValidationResult(data);
          toast.error(data.globalErrors[0]);
        } else {
          const errData = data as unknown as { error?: string };
          throw new Error(errData.error || 'Validation failed');
        }
        return;
      }

      setValidationResult(data);

      if (data.isValid) {
        toast.success(`Validated ${data.validTradesCount} trade${data.validTradesCount > 1 ? 's' : ''} successfully!`);
      } else {
        toast.error(`Validation found errors in ${data.invalidTradesCount} trade record(s)`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Validation request failed';
      toast.error('Validation request failed', { description: message });
    } finally {
      setIsValidating(false);
    }
  };

  // Final Import Action
  const handleImport = async () => {
    if (!validationResult || !validationResult.isValid) {
      toast.error('Please validate the JSON successfully before importing');
      return;
    }

    setIsImporting(true);

    try {
      const res = await fetch('/api/trades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import trades');
      }

      setImportSummary({
        importedCount: data.importedCount,
        tradeIds: data.tradeIds || [],
        successful: data.summary?.successful || [],
      });

      toast.success(`Successfully imported ${data.importedCount} trade${data.importedCount > 1 ? 's' : ''}!`);
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      toast.error('Import failed', { description: message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    handleClear();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--background)]/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[var(--foreground)]">
                Import Trade from JSON
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Paste JSON trades generated by ChatGPT or another trading assistant
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Post-Import Success Screen */}
          {importSummary ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-[var(--foreground)]">
                  Import Completed Successfully
                </h4>
                <p className="text-sm text-[var(--muted)]">
                  Created {importSummary.importedCount} real trade record(s) with initial stop-loss history and risk snapshots.
                </p>
              </div>

              {/* Imported Trades Chips */}
              <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-md mx-auto">
                {importSummary.successful.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {item.symbol}
                  </span>
                ))}
              </div>

              <div className="pt-6 flex justify-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all"
                >
                  View in Trade Journal
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Textarea Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-blue-500" />
                  Paste JSON Trade Specification:
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--card)] text-xs font-medium text-[var(--foreground)] transition-colors"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5 text-blue-500" />
                    <span>Paste</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadExample}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--card)] text-xs font-medium text-[var(--foreground)] transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Example JSON</span>
                  </button>
                  {jsonText && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:bg-[var(--card)] text-xs font-medium text-[var(--muted)] hover:text-rose-400 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              </div>

              {/* JSON Textarea */}
              <div className="relative">
                <textarea
                  rows={8}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    if (validationResult) setValidationResult(null);
                  }}
                  placeholder={`{\n  "schema_version": "1.0",\n  "trades": [\n    {\n      "portfolio_owner": "me",\n      "broker": "ZERODHA",\n      "exchange": "NSE",\n      "symbol": "UNIONBANK",\n      "trade_type": "SWING",\n      "direction": "LONG",\n      "entry_price": 182.45,\n      "initial_stop_loss": 175.50,\n      "quantity": 10\n    }\n  ]\n}`}
                  className="w-full p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs sm:text-sm text-[var(--foreground)] focus:border-blue-500 focus:outline-none transition-all resize-y leading-relaxed"
                />
              </div>

              {/* Global Validation Errors Display */}
              {validationResult?.globalErrors && validationResult.globalErrors.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Schema Validation Error</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {validationResult.globalErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duplicate Warnings Banner */}
              {validationResult && validationResult.duplicateCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Duplicate Warnings Detected ({validationResult.duplicateCount})</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90">
                    One or more trades match existing open positions or appear multiple times in this batch. Review before final confirmation.
                  </p>
                </div>
              )}

              {/* Validation Preview Section */}
              {validationResult && validationResult.trades.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] flex items-center gap-2">
                      <span>Import Preview</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-normal">
                        {validationResult.validTradesCount} of {validationResult.totalTrades} Valid
                      </span>
                    </h4>
                  </div>

                  {/* Responsive Cards (Mobile-first, optimized for Android) */}
                  <div className="space-y-3">
                    {validationResult.trades.map((item) => (
                      <div
                        key={item.index}
                        className={cn(
                          'p-4 rounded-2xl border transition-all text-xs space-y-3',
                          item.isValid
                            ? 'bg-[var(--card)] border-[var(--border)]'
                            : 'bg-rose-500/5 border-rose-500/30'
                        )}
                      >
                        {/* Card Header: Symbol, Direction, Status Badge */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-sm sm:text-base text-[var(--foreground)]">
                              {item.symbol || 'UNKNOWN'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--border)] font-mono text-[var(--muted)]">
                              {item.exchange}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1',
                                item.direction === 'LONG'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              )}
                            >
                              {item.direction === 'LONG' ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {item.direction}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                              {item.tradeType}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.isDuplicate && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-medium">
                                <AlertTriangle className="w-3 h-3" />
                                Duplicate Warning
                              </span>
                            )}
                            {item.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-semibold">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Invalid
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Trade Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                          <div className="p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                            <span className="text-[10px] text-[var(--muted)] block">Portfolio Owner</span>
                            <span className="font-semibold text-[var(--foreground)] truncate block">
                              {item.portfolioOwnerLabel || item.portfolioOwnerRaw}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                            <span className="text-[10px] text-[var(--muted)] block">Broker</span>
                            <span className="font-semibold text-[var(--foreground)] truncate block">
                              {item.brokerName || item.brokerRaw}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                            <span className="text-[10px] text-[var(--muted)] block">Entry Price × Qty</span>
                            <span className="font-mono font-semibold text-[var(--foreground)]">
                              {item.entryPrice > 0 ? formatINR(item.entryPrice) : '—'} × {item.quantity || '—'}
                            </span>
                          </div>

                          <div className="p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                            <span className="text-[10px] text-[var(--muted)] block">Initial Stop-Loss</span>
                            <span className="font-mono font-semibold text-rose-400">
                              {item.initialStopLoss > 0 ? formatINR(item.initialStopLoss) : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Risk Metrics Banner (when valid) */}
                        {item.isValid && item.riskPerShare != null && (
                          <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
                            <div className="flex items-center gap-3">
                              <span>
                                <span className="text-[var(--muted)]">Risk/Shr: </span>
                                <strong className="text-[var(--foreground)]">{formatINR(item.riskPerShare)}</strong>
                              </span>
                              <span>
                                <span className="text-[var(--muted)]">Total Risk (1R): </span>
                                <strong className="text-rose-400">{formatINR(item.riskRupees ?? 0)}</strong>
                              </span>
                              <span>
                                <span className="text-[var(--muted)]">Risk %: </span>
                                <strong className="text-[var(--foreground)]">
                                  {item.riskPct?.toFixed(2)}%
                                </strong>
                              </span>
                            </div>

                            {item.targetPrice && (
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--muted)]">Target: </span>
                                <strong className="text-emerald-400">{formatINR(item.targetPrice)}</strong>
                                {item.plannedRR && (
                                  <span className="text-emerald-400/90 font-bold">
                                    ({item.plannedRR.toFixed(1)}R)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Optional Strategy & Notes */}
                        {(item.strategy || item.notes) && (
                          <div className="text-[11px] text-[var(--muted)] pt-0.5 space-y-0.5">
                            {item.strategy && (
                              <p>
                                <span className="font-semibold text-[var(--foreground)]">Strategy: </span>
                                {item.strategy}
                              </p>
                            )}
                            {item.notes && (
                              <p className="line-clamp-2 italic text-[var(--muted)]">
                                &quot;{item.notes}&quot;
                              </p>
                            )}
                          </div>
                        )}

                        {/* Duplicate Warning Details */}
                        {item.duplicateWarning && (
                          <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                            ⚠️ {item.duplicateWarning}
                          </div>
                        )}

                        {/* Field Errors List (if invalid) */}
                        {item.errors.length > 0 && (
                          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] space-y-1">
                            <span className="font-semibold block text-rose-400">Issues to resolve:</span>
                            <ul className="list-disc pl-4 space-y-0.5">
                              {item.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!importSummary && (
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--background)]/50">
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting || isValidating}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--card)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleValidate}
                disabled={isValidating || isImporting || !jsonText.trim()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--card)] hover:bg-[var(--background)] border border-[var(--border)] text-xs font-bold text-[var(--foreground)] transition-colors disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span>Validate JSON</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleImport}
                disabled={
                  isImporting ||
                  isValidating ||
                  !validationResult ||
                  !validationResult.isValid ||
                  validationResult.validTradesCount === 0
                }
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>
                      {validationResult?.validTradesCount
                        ? `Import ${validationResult.validTradesCount} Trade${validationResult.validTradesCount > 1 ? 's' : ''}`
                        : 'Import Trades'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
