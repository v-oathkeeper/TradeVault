'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Save,
  Clock,
  Building2,
  User,
  Target,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Tag,
} from 'lucide-react';
import { CreateTradeSchema, type CreateTradeInput } from '@/lib/validation/schemas';
import { useUser } from '@/components/providers/UserContext';
import { calculateFeesForTrade } from '@/lib/calculations/fee-engine';
import { calculateGrossPnl } from '@/lib/calculations/pnl';
import { toDecimal } from '@/lib/calculations/decimal-utils';
import { calculateInitialRisk } from '@/lib/calculations/r-multiple';
import { formatINR, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

interface TradeFormProps {
  brokers: { id: string; code: 'KITE' | 'SHOONYA'; name: string }[];
  initialData?: Partial<CreateTradeInput> & { id?: string };
  isEditing?: boolean;
}

export function TradeForm({ brokers, initialData, isEditing = false }: TradeFormProps) {
  const router = useRouter();
  const { persons, isAdmin } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitFields, setShowExitFields] = useState(
    Boolean(initialData?.exitPrice || initialData?.exitAt)
  );
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);

  const defaultBrokerId = brokers[0]?.id ?? '';
  const defaultPersonId = persons[0]?.id ?? '';

  // Current datetime in YYYY-MM-DDTHH:mm format for HTML datetime-local input
  const nowStr = new Date().toISOString().slice(0, 16);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTradeInput>({
    resolver: zodResolver(CreateTradeSchema) as any,
    defaultValues: {
      portfolioOwnerId: initialData?.portfolioOwnerId ?? defaultPersonId,
      brokerId: initialData?.brokerId ?? defaultBrokerId,
      tradeType: initialData?.tradeType ?? 'INTRADAY',
      direction: initialData?.direction ?? 'LONG',
      exchange: initialData?.exchange ?? 'NSE',
      symbol: initialData?.symbol ?? '',
      quantity: initialData?.quantity ?? 1,
      entryPrice: initialData?.entryPrice ?? 0,
      initialStopLoss: initialData?.initialStopLoss ?? 0,
      plannedTarget: initialData?.plannedTarget ?? null,
      strategyName: initialData?.strategyName ?? '',
      entryAt: initialData?.entryAt ? initialData.entryAt.slice(0, 16) : nowStr,
      exitPrice: initialData?.exitPrice ?? null,
      exitAt: initialData?.exitAt ? initialData.exitAt.slice(0, 16) : null,
      notes: initialData?.notes ?? '',
    },
  });

  const watched = watch();

  // Keep portfolioOwnerId and brokerId synchronized when persons/brokers load
  useEffect(() => {
    if (
      persons.length > 0 &&
      (!watched.portfolioOwnerId || !persons.some((p) => p.id === watched.portfolioOwnerId))
    ) {
      setValue('portfolioOwnerId', initialData?.portfolioOwnerId ?? persons[0].id, { shouldValidate: true });
    }
  }, [persons, watched.portfolioOwnerId, initialData?.portfolioOwnerId, setValue]);

  useEffect(() => {
    if (
      brokers.length > 0 &&
      (!watched.brokerId || !brokers.some((b) => b.id === watched.brokerId))
    ) {
      setValue('brokerId', initialData?.brokerId ?? brokers[0].id, { shouldValidate: true });
    }
  }, [brokers, watched.brokerId, initialData?.brokerId, setValue]);

  // Selected broker code
  const selectedBroker = useMemo(() => {
    return brokers.find((b) => b.id === watched.brokerId);
  }, [brokers, watched.brokerId]);

  // Live R-multiple risk preview
  const riskPreview = useMemo(() => {
    const entry = Number(watched.entryPrice) || 0;
    const stop = Number(watched.initialStopLoss) || 0;
    const qty = Number(watched.quantity) || 0;
    const target = watched.plannedTarget ? Number(watched.plannedTarget) : null;

    if (entry <= 0 || stop <= 0 || qty <= 0) return null;

    return calculateInitialRisk({
      entryPrice: entry,
      initialStopLoss: stop,
      quantity: qty,
      direction: watched.direction,
      plannedTarget: target,
    });
  }, [
    watched.entryPrice,
    watched.initialStopLoss,
    watched.quantity,
    watched.direction,
    watched.plannedTarget,
  ]);

  // Live P&L calculation preview (only when exit is provided)
  const livePreview = useMemo(() => {
    const qty = Number(watched.quantity) || 0;
    const entry = Number(watched.entryPrice) || 0;
    const exit = Number(watched.exitPrice) || 0;

    if (qty <= 0 || entry <= 0 || !showExitFields || exit <= 0) {
      return null;
    }

    const brokerCode = selectedBroker?.code ?? 'KITE';
    const isKite = brokerCode === 'KITE';
    const isIntraday = watched.tradeType === 'INTRADAY';
    const isBSE = watched.exchange === 'BSE';

    // Fallback fee rates matching official schedule
    const feeRates = {
      brokerId: watched.brokerId,
      brokerCode,
      exchange: watched.exchange,
      productType: watched.tradeType,
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
          rate: isBSE ? 0.0000375 : 0.0000307,
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

    const gross = calculateGrossPnl({
      direction: watched.direction,
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
    });

    const fees = calculateFeesForTrade({
      broker: brokerCode,
      exchange: watched.exchange,
      tradeType: watched.tradeType,
      direction: watched.direction,
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
      feeRates,
      isDpEvent: watched.tradeType === 'DELIVERY',
    });

    const net = gross.minus(toDecimal(fees.totalCharges)).toNumber();

    // Compute realized R if risk is known
    const realizedR = riskPreview && riskPreview.riskRupees > 0
      ? net / riskPreview.riskRupees
      : null;

    return {
      grossPnl: gross.toNumber(),
      totalCharges: fees.totalCharges,
      netPnl: net,
      brokerage: fees.brokerage,
      stt: fees.stt,
      exchangeCharges: fees.exchangeCharges,
      gst: fees.gst,
      sebiCharges: fees.sebiCharges,
      stampDuty: fees.stampDuty,
      dpCharges: fees.dpCharges,
      realizedR,
    };
  }, [
    watched.quantity,
    watched.entryPrice,
    watched.exitPrice,
    watched.direction,
    watched.tradeType,
    watched.exchange,
    watched.brokerId,
    selectedBroker,
    showExitFields,
    riskPreview,
  ]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[var(--card)] border border-[var(--border)] max-w-md mx-auto my-12">
        <Shield className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h3 className="text-lg font-bold">Admin Permission Required</h3>
        <p className="text-xs text-[var(--muted)] mt-1">
          Your account has read-only access (Viewer). Only the Husband (Admin) can record or modify trades.
        </p>
      </div>
    );
  }

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        symbol: data.symbol.toUpperCase().trim(),
        exitPrice: showExitFields && data.exitPrice ? Number(data.exitPrice) : null,
        exitAt: showExitFields && data.exitAt ? new Date(data.exitAt).toISOString() : null,
        entryAt: new Date(data.entryAt).toISOString(),
        initialStopLoss: Number(data.initialStopLoss),
        plannedTarget: data.plannedTarget ? Number(data.plannedTarget) : null,
        strategyName: data.strategyName?.trim() || null,
      };

      const endpoint = isEditing && initialData?.id ? `/api/trades/${initialData.id}` : '/api/trades';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to save trade');
      }

      toast.success(isEditing ? 'Trade updated successfully' : 'Trade recorded successfully');
      router.push('/trades');
      router.refresh();
    } catch (err: any) {
      toast.error('Could not save trade', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stop-loss direction validation indicator
  const stopLossValidation = useMemo(() => {
    const entry = Number(watched.entryPrice) || 0;
    const stop = Number(watched.initialStopLoss) || 0;
    if (!entry || !stop) return null;
    if (watched.direction === 'LONG' && stop >= entry) {
      return { valid: false, message: 'Stop must be BELOW entry for LONG' };
    }
    if (watched.direction === 'SHORT' && stop <= entry) {
      return { valid: false, message: 'Stop must be ABOVE entry for SHORT' };
    }
    return { valid: true, message: '' };
  }, [watched.entryPrice, watched.initialStopLoss, watched.direction]);

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            {isEditing ? 'Edit Trade' : 'Record New Trade'}
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Risk-first trade logging with R-multiple tracking and automated statutory tax computation
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* 1. Portfolio Owner & Broker Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Portfolio Owner
              </label>
              <select
                {...register('portfolioOwnerId')}
                value={watched.portfolioOwnerId || ''}
                onChange={(e) => setValue('portfolioOwnerId', e.target.value, { shouldValidate: true })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium focus:border-blue-500 transition-colors"
              >
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.relationshipLabel})
                  </option>
                ))}
              </select>
              {errors.portfolioOwnerId && (
                <p className="text-xs text-rose-500">{errors.portfolioOwnerId.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-orange-500" />
                Broker
              </label>
              <select
                {...register('brokerId')}
                value={watched.brokerId || ''}
                onChange={(e) => setValue('brokerId', e.target.value, { shouldValidate: true })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium focus:border-blue-500 transition-colors"
              >
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              {errors.brokerId && (
                <p className="text-xs text-rose-500">{errors.brokerId.message}</p>
              )}
            </div>
          </div>

          {/* 2. Trade Type & Direction Segmented Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Product Type
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setValue('tradeType', 'INTRADAY', { shouldValidate: true })}
                  className={cn(
                    'py-2 rounded-lg transition-all',
                    watched.tradeType === 'INTRADAY'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  )}
                >
                  Intraday (MIS)
                </button>
                <button
                  type="button"
                  onClick={() => setValue('tradeType', 'DELIVERY', { shouldValidate: true })}
                  className={cn(
                    'py-2 rounded-lg transition-all',
                    watched.tradeType === 'DELIVERY'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  )}
                >
                  Delivery (CNC)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Direction
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setValue('direction', 'LONG', { shouldValidate: true })}
                  className={cn(
                    'py-2 rounded-lg flex items-center justify-center gap-1 transition-all',
                    watched.direction === 'LONG'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  )}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Long (Buy)
                </button>
                <button
                  type="button"
                  onClick={() => setValue('direction', 'SHORT', { shouldValidate: true })}
                  className={cn(
                    'py-2 rounded-lg flex items-center justify-center gap-1 transition-all',
                    watched.direction === 'SHORT'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  )}
                >
                  <ArrowDownRight className="w-4 h-4" />
                  Short (Sell)
                </button>
              </div>
            </div>
          </div>

          {/* 3. Symbol & Exchange */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Stock Symbol
              </label>
              <input
                type="text"
                placeholder="e.g. RELIANCE, TATASTEEL"
                {...register('symbol')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-bold uppercase tracking-wider font-mono focus:border-blue-500 transition-colors"
                onChange={(e) => setValue('symbol', e.target.value.toUpperCase(), { shouldValidate: true })}
              />
              {errors.symbol && (
                <p className="text-xs text-rose-500">{errors.symbol.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Exchange
              </label>
              <select
                {...register('exchange')}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-semibold focus:border-blue-500 transition-colors"
              >
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </div>
          </div>

          {/* 4. Entry Price, Quantity, Entry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Entry Price (₹)
              </label>
              <input
                type="number"
                step="0.05"
                placeholder="0.00"
                {...register('entryPrice', { valueAsNumber: true })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-bold font-mono focus:border-blue-500 transition-colors"
              />
              {errors.entryPrice && (
                <p className="text-xs text-rose-500">{errors.entryPrice.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Quantity
              </label>
              <input
                type="number"
                step="1"
                placeholder="100"
                {...register('quantity', { valueAsNumber: true })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-bold font-mono focus:border-blue-500 transition-colors"
              />
              {errors.quantity && (
                <p className="text-xs text-rose-500">{errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--foreground)]">
                Entry Time
              </label>
              <input
                type="datetime-local"
                {...register('entryAt')}
                className="w-full px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
              />
              {errors.entryAt && (
                <p className="text-xs text-rose-500">{errors.entryAt.message}</p>
              )}
            </div>
          </div>

          {/* 5. ── RISK MANAGEMENT SECTION ─────────────────────────── */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/5 to-orange-500/5 border border-rose-500/20 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Risk Definition (Required)
              </span>
            </div>

            {/* Stop-Loss + Planned Target Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  Initial Stop-Loss (₹)
                  <span className="text-rose-400 text-[10px] font-normal">
                    {watched.direction === 'LONG' ? '(below entry)' : '(above entry)'}
                  </span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  placeholder="0.00"
                  {...register('initialStopLoss', { valueAsNumber: true })}
                  className={cn(
                    'w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border text-sm font-bold font-mono transition-colors',
                    stopLossValidation?.valid === false
                      ? 'border-rose-500 focus:border-rose-500'
                      : stopLossValidation?.valid === true
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : 'border-[var(--border)] focus:border-rose-400'
                  )}
                />
                {/* Inline validation feedback */}
                {stopLossValidation?.valid === false && (
                  <p className="text-xs text-rose-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {stopLossValidation.message}
                  </p>
                )}
                {errors.initialStopLoss && (
                  <p className="text-xs text-rose-500">{(errors.initialStopLoss as any).message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-500" />
                  Planned Target (₹)
                  <span className="text-[var(--muted)] text-[10px] font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  placeholder="0.00"
                  {...register('plannedTarget', { valueAsNumber: true })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-bold font-mono focus:border-emerald-500 transition-colors"
                />
                {errors.plannedTarget && (
                  <p className="text-xs text-rose-500">{(errors.plannedTarget as any).message}</p>
                )}
              </div>
            </div>

            {/* Live Risk Preview */}
            {riskPreview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-rose-500/20 text-center">
                  <span className="block text-[10px] text-rose-400 uppercase font-semibold">Risk/Share</span>
                  <span className="text-sm font-bold font-mono text-rose-400">
                    ₹{riskPreview.riskPerShare.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-rose-500/20 text-center">
                  <span className="block text-[10px] text-rose-400 uppercase font-semibold">Total 1R</span>
                  <span className="text-sm font-bold font-mono text-rose-400">
                    {formatINR(riskPreview.riskRupees)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-rose-500/20 text-center">
                  <span className="block text-[10px] text-rose-400 uppercase font-semibold">Risk %</span>
                  <span className="text-sm font-bold font-mono text-rose-400">
                    {riskPreview.riskPct.toFixed(2)}%
                  </span>
                </div>
                {riskPreview.plannedRR !== null ? (
                  <div className="p-2.5 rounded-xl bg-[var(--card)] border border-emerald-500/20 text-center">
                    <span className="block text-[10px] text-emerald-400 uppercase font-semibold">Plan R:R</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      1:{riskPreview.plannedRR.toFixed(1)}
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-center opacity-40">
                    <span className="block text-[10px] text-[var(--muted)] uppercase font-semibold">Plan R:R</span>
                    <span className="text-sm font-bold font-mono text-[var(--muted)]">—</span>
                  </div>
                )}
              </div>
            )}

            {/* R-Level Targets */}
            {riskPreview && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                  R-Multiple Price Levels
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '1R', price: riskPreview.r1Price, color: 'text-lime-400 bg-lime-500/10 border-lime-500/30' },
                    { label: '2R', price: riskPreview.r2Price, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
                    { label: '3R', price: riskPreview.r3Price, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
                    { label: '4R', price: riskPreview.r4Price, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
                  ].map(({ label, price, color }) => (
                    <span
                      key={label}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono',
                        color
                      )}
                    >
                      <span className="font-normal opacity-70">{label}</span>
                      ₹{price.toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Strategy / Setup Tag (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvancedFields(!showAdvancedFields)}
              className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              Strategy / Setup Name (optional)
              {showAdvancedFields ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {showAdvancedFields && (
              <div className="mt-2.5 space-y-1.5">
                <input
                  type="text"
                  placeholder="e.g. Breakout, Pullback, Opening Range, Momentum..."
                  {...register('strategyName')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:border-blue-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* 7. Closed Trade Toggle / Optional Exit Section */}
          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs font-semibold text-[var(--foreground)] block">
                  Close Trade Immediately?
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  Toggle on if this trade is already closed with an exit fill
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowExitFields(!showExitFields)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative',
                  showExitFields ? 'bg-blue-600' : 'bg-[var(--border)]'
                )}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full bg-white absolute top-1 transition-transform',
                    showExitFields ? 'left-6' : 'left-1'
                  )}
                />
              </button>
            </div>

            {showExitFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-[var(--background)] border border-[var(--border)]">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Exit Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="0.00"
                    {...register('exitPrice', { valueAsNumber: true })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] text-sm font-bold font-mono focus:border-blue-500 transition-colors"
                  />
                  {errors.exitPrice && (
                    <p className="text-xs text-rose-500">{(errors.exitPrice as any).message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--foreground)]">
                    Exit Time
                  </label>
                  <input
                    type="datetime-local"
                    {...register('exitAt')}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
                  />
                  {errors.exitAt && (
                    <p className="text-xs text-rose-500">{(errors.exitAt as any).message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 8. Live Calculations Preview Box */}
          {livePreview && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-500/20 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-500">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  Estimated Real-Time Breakdown
                </span>
                <span className="font-mono text-[11px]">
                  {selectedBroker?.code} • {watched.exchange}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-semibold">Gross P&L</span>
                  <span
                    className={cn(
                      'text-sm font-bold font-mono',
                      livePreview.grossPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    )}
                  >
                    {formatINR(livePreview.grossPnl, { showSign: true })}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-semibold">Total Charges</span>
                  <span className="text-sm font-bold font-mono text-amber-500">
                    {formatINR(livePreview.totalCharges)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-semibold">Net P&L</span>
                  <span
                    className={cn(
                      'text-sm font-bold font-mono',
                      livePreview.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    )}
                  >
                    {formatINR(livePreview.netPnl, { showSign: true })}
                  </span>
                </div>
                {/* Realized R badge */}
                <div className="p-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)]">
                  <span className="block text-[10px] text-[var(--muted)] uppercase font-semibold">Realized R</span>
                  {livePreview.realizedR !== null ? (
                    <span
                      className={cn(
                        'text-sm font-bold font-mono',
                        livePreview.realizedR >= 1
                          ? 'text-emerald-500'
                          : livePreview.realizedR >= 0
                          ? 'text-lime-500'
                          : livePreview.realizedR >= -1
                          ? 'text-orange-400'
                          : 'text-rose-500'
                      )}
                    >
                      {livePreview.realizedR >= 0 ? '+' : ''}
                      {livePreview.realizedR.toFixed(2)}R
                    </span>
                  ) : (
                    <span className="text-sm font-bold font-mono text-[var(--muted)]">—</span>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1 font-mono pt-1 border-t border-[var(--border)]">
                <span>Brokerage: ₹{livePreview.brokerage}</span>
                <span>STT: ₹{livePreview.stt}</span>
                <span>Exch: ₹{livePreview.exchangeCharges}</span>
                <span>GST: ₹{livePreview.gst}</span>
                <span>Stamp: ₹{livePreview.stampDuty}</span>
                {livePreview.dpCharges > 0 && <span>DP: ₹{livePreview.dpCharges}</span>}
              </div>
            </div>
          )}

          {/* 9. Optional Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Trade rationale, market context, lessons learned..."
              {...register('notes')}
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* 10. Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--background)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || stopLossValidation?.valid === false}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-blue-500/25 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Update Trade' : 'Save Trade'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
