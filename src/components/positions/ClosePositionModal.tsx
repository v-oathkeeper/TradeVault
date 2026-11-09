'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClosePositionSchema, type ClosePositionInput } from '@/lib/validation/schemas';
import { formatINR, cn } from '@/lib/utils';
import { calculateGrossPnl } from '@/lib/calculations/pnl';
import { calculateFeesForTrade } from '@/lib/calculations/fee-engine';
import { toDecimal } from '@/lib/calculations/decimal-utils';
import { X, CheckCircle, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import type { Trade } from '@/types/app';

interface ClosePositionModalProps {
  trade: Trade | null;
  open: boolean;
  onClose: () => void;
  onTradeClosed?: (tradeId: string) => void;
  onRollback?: (trade: Trade) => void;
}

export function ClosePositionModal({
  trade,
  open,
  onClose,
  onTradeClosed,
  onRollback,
}: ClosePositionModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nowStr = new Date().toISOString().slice(0, 16);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ClosePositionInput>({
    resolver: zodResolver(ClosePositionSchema) as any,
    defaultValues: {
      tradeId: trade?.id ?? '',
      exitPrice: trade?.entryPrice ?? 0,
      exitAt: nowStr,
    },
    values: trade
      ? {
          tradeId: trade.id,
          exitPrice: trade.entryPrice,
          exitAt: nowStr,
        }
      : undefined,
  });

  const watchedExitPrice = watch('exitPrice');

  // Preview P&L
  const preview = useMemo(() => {
    if (!trade || !watchedExitPrice || watchedExitPrice <= 0) return null;

    const exitPrice = Number(watchedExitPrice);
    const brokerCode = trade.broker?.code ?? 'KITE';
    const isKite = brokerCode === 'KITE';
    const isIntraday = trade.tradeType === 'INTRADAY';

    const gross = calculateGrossPnl({
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice,
      quantity: trade.quantity,
    });

    const feeRates = {
      brokerId: trade.brokerId,
      brokerCode,
      exchange: trade.exchange,
      productType: trade.tradeType,
      capturedAt: new Date().toISOString(),
      rates: [
        {
          chargeType: 'BROKERAGE',
          rate: 0.0003,
          maxPerOrder: isIntraday ? (isKite ? 20 : 5) : null,
          appliesToSide: 'BOTH' as const,
          calculationBasis: 'TURNOVER_PCT' as const,
          securityGroup: null,
        },
        {
          chargeType: 'STT',
          rate: isIntraday ? 0.00025 : 0.001,
          maxPerOrder: null,
          appliesToSide: (isIntraday ? 'SELL' : 'BOTH') as any,
          calculationBasis: 'TURNOVER_PCT' as const,
          securityGroup: null,
        },
        {
          chargeType: 'EXCHANGE_TXN',
          rate: 0.0000307,
          maxPerOrder: null,
          appliesToSide: 'BOTH' as const,
          calculationBasis: 'TURNOVER_PCT' as const,
          securityGroup: null,
        },
        {
          chargeType: 'SEBI',
          rate: 0.000001,
          maxPerOrder: null,
          appliesToSide: 'BOTH' as const,
          calculationBasis: 'TURNOVER_PCT' as const,
          securityGroup: null,
        },
        {
          chargeType: 'STAMP_DUTY',
          rate: isIntraday ? 0.00003 : 0.00015,
          maxPerOrder: null,
          appliesToSide: 'BUY' as const,
          calculationBasis: 'TURNOVER_PCT' as const,
          securityGroup: null,
        },
        {
          chargeType: 'GST',
          rate: 0.18,
          maxPerOrder: null,
          appliesToSide: 'BOTH' as const,
          calculationBasis: 'ON_SERVICE_CHARGES' as const,
          securityGroup: null,
        },
        ...(!isIntraday
          ? [
              {
                chargeType: 'DP',
                rate: isKite ? 15.34 : 9.0,
                maxPerOrder: null,
                appliesToSide: 'SELL' as const,
                calculationBasis: 'FLAT_PER_EVENT' as const,
                securityGroup: null,
              },
            ]
          : []),
      ],
    };

    const fees = calculateFeesForTrade({
      broker: brokerCode,
      exchange: trade.exchange,
      tradeType: trade.tradeType,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice,
      quantity: trade.quantity,
      feeRates,
      isDpEvent: trade.tradeType === 'DELIVERY',
    });

    const net = gross.minus(toDecimal(fees.totalCharges)).toNumber();

    return {
      grossPnl: gross.toNumber(),
      totalCharges: fees.totalCharges,
      netPnl: net,
    };
  }, [trade, watchedExitPrice]);

  if (!open || !trade) return null;

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    const closingTrade = trade;

    // Optimistically notify parent immediately
    onTradeClosed?.(closingTrade.id);
    onClose();

    try {
      const res = await fetch(`/api/trades/${closingTrade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...closingTrade,
          exitPrice: Number(data.exitPrice),
          exitAt: new Date(data.exitAt).toISOString(),
          status: 'CLOSED',
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to close position');
      }

      toast.success(`Closed position for ${closingTrade.symbol}`);
    } catch (err: any) {
      // Revert optimistic removal on server failure
      onRollback?.(closingTrade);
      toast.error('Could not close position', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-[var(--foreground)]">
              Close Position: {trade.symbol}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {trade.quantity} shares • Entry: {formatINR(trade.entryPrice)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--background)] text-[var(--muted)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Exit Price (₹)
            </label>
            <input
              type="number"
              step="0.05"
              {...register('exitPrice', { valueAsNumber: true })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-bold font-mono focus:border-blue-500 transition-colors"
            />
            {errors.exitPrice && (
              <p className="text-xs text-rose-500">{errors.exitPrice.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Exit Date & Time
            </label>
            <input
              type="datetime-local"
              {...register('exitAt')}
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
            />
            {errors.exitAt && (
              <p className="text-xs text-rose-500">{errors.exitAt.message}</p>
            )}
          </div>

          {preview && (
            <div className="p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] space-y-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-blue-500 font-semibold text-[11px]">
                <Calculator className="w-3.5 h-3.5" />
                Live Net Realized Outcome
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div>
                  <span className="text-[10px] text-[var(--muted)] block">Gross</span>
                  <span className={preview.grossPnl >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                    {formatINR(preview.grossPnl, { showSign: true })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] block">Charges</span>
                  <span className="text-amber-500 font-bold">
                    {formatINR(preview.totalCharges)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] block">Net Return</span>
                  <span className={preview.netPnl >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                    {formatINR(preview.netPnl, { showSign: true })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-medium hover:bg-[var(--background)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Closing...' : 'Confirm Exit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
