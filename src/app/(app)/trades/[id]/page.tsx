import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Badge } from '@/components/ui/Badge';
import { PnlDisplay } from '@/components/ui/PnlDisplay';
import { StopLossManager } from '@/components/positions/StopLossManager';
import { formatINR, formatDate } from '@/lib/utils';
import { classifyROutcome } from '@/lib/calculations/r-multiple';
import {
  ArrowLeft,
  Edit2,
  Receipt,
  TrendingDown,
  Tag,
  Target,
} from 'lucide-react';
import type { Trade, StopLossHistoryEntry } from '@/types/app';

interface TradeDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Trade Breakdown',
  description: 'Itemized fee calculations, R-multiple tracking, and trade audit snapshot',
};

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .single();

  const isAdmin = member?.role === 'ADMIN';

  const { data: trade, error } = await supabase
    .from('trades')
    .select(`
      *,
      portfolio_owner:persons(id, display_name, relationship_label),
      broker:brokers(id, code, name),
      stop_loss_history(*)
    `)
    .eq('id', id)
    .single();

  if (error || !trade) {
    notFound();
  }

  const breakdown = (trade.charges_breakdown as any) || {};
  const turnover =
    trade.exit_price
      ? (Number(trade.entry_price) + Number(trade.exit_price)) * trade.quantity
      : Number(trade.entry_price) * trade.quantity;

  const returnPct =
    trade.gross_pnl && trade.entry_price && trade.quantity
      ? (Number(trade.gross_pnl) / (Number(trade.entry_price) * trade.quantity)) * 100
      : null;

  // Map stop-loss history
  const rawHistory = ((trade as any).stop_loss_history as any[]) ?? [];
  const stopHistory: StopLossHistoryEntry[] = rawHistory
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((h) => ({
      id: h.id,
      tradeId: h.trade_id,
      previousStop: h.previous_stop ? Number(h.previous_stop) : null,
      newStop: Number(h.new_stop),
      stopType: h.stop_type,
      marketPriceAtUpdate: h.market_price_at_update ? Number(h.market_price_at_update) : null,
      floatingRAtUpdate: h.floating_r_at_update ? Number(h.floating_r_at_update) : null,
      notes: h.notes,
      createdBy: h.created_by,
      createdAt: h.created_at,
    }));

  const tradeData = trade as any;

  // Map to Trade type for StopLossManager
  const tradeMapped: Trade = {
    id: trade.id,
    householdId: trade.household_id,
    portfolioOwnerId: trade.portfolio_owner_id,
    brokerId: trade.broker_id,
    symbol: trade.symbol,
    exchange: trade.exchange,
    tradeType: trade.trade_type,
    direction: trade.direction,
    quantity: trade.quantity,
    entryPrice: Number(trade.entry_price),
    exitPrice: trade.exit_price ? Number(trade.exit_price) : null,
    entryAt: trade.entry_at,
    exitAt: trade.exit_at,
    grossPnl: trade.gross_pnl ? Number(trade.gross_pnl) : null,
    totalCharges: Number(trade.total_charges ?? 0),
    netPnl: trade.net_pnl ? Number(trade.net_pnl) : null,
    chargesBreakdown: null,
    calculationStatus: trade.calculation_status,
    status: trade.status,
    notes: trade.notes,
    createdBy: trade.created_by,
    updatedBy: trade.updated_by,
    createdAt: trade.created_at,
    updatedAt: trade.updated_at,
    // R-Multiple fields
    initialStopLoss: tradeData.initial_stop_loss ? Number(tradeData.initial_stop_loss) : null,
    initialRiskPerShare: tradeData.initial_risk_per_share ? Number(tradeData.initial_risk_per_share) : null,
    initialRiskRupees: tradeData.initial_risk_rupees ? Number(tradeData.initial_risk_rupees) : null,
    initialRiskPct: tradeData.initial_risk_pct ? Number(tradeData.initial_risk_pct) : null,
    plannedTarget: tradeData.planned_target ? Number(tradeData.planned_target) : null,
    plannedRR: tradeData.planned_rr ? Number(tradeData.planned_rr) : null,
    r1Price: tradeData.r1_price ? Number(tradeData.r1_price) : null,
    r2Price: tradeData.r2_price ? Number(tradeData.r2_price) : null,
    r3Price: tradeData.r3_price ? Number(tradeData.r3_price) : null,
    strategyName: tradeData.strategy_name,
    currentStopLoss: tradeData.current_stop_loss ? Number(tradeData.current_stop_loss) : null,
    maxAdverseExcursion: tradeData.max_adverse_excursion ? Number(tradeData.max_adverse_excursion) : null,
    maxFavorableExcursion: tradeData.max_favorable_excursion ? Number(tradeData.max_favorable_excursion) : null,
    realizedRMultiple: tradeData.realized_r_multiple ? Number(tradeData.realized_r_multiple) : null,
    grossRMultiple: tradeData.gross_r_multiple ? Number(tradeData.gross_r_multiple) : null,
    broker: trade.broker as any,
    portfolioOwner: trade.portfolio_owner as any,
  };

  // R-multiple outcome label
  const realizedR = tradeMapped.realizedRMultiple;
  const rOutcome = realizedR != null
    ? classifyROutcome(realizedR)
    : null;

  const rOutcomeStyles: Record<string, string> = {
    big_winner: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    winner: 'text-lime-400 bg-lime-500/10 border-lime-500/30',
    small_winner: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    scratch: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
    small_loss: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    full_loss: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    big_loss: 'text-red-500 bg-red-500/10 border-red-500/30',
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={`Trade: ${trade.symbol}`} />

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 w-full">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/trades"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Journal</span>
          </Link>

          {isAdmin && (
            <Link
              href={`/trades/${trade.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs font-semibold hover:bg-[var(--card)] transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-500" />
              <span>Edit Record</span>
            </Link>
          )}
        </div>

        {/* Hero Card */}
        <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold font-mono text-[var(--foreground)]">
                  {trade.symbol}
                </h1>
                <Badge variant={trade.trade_type === 'INTRADAY' ? 'intraday' : 'delivery'}>
                  {trade.trade_type}
                </Badge>
                <Badge variant={(trade.broker?.code ?? 'KITE').toLowerCase() as any}>
                  {trade.broker?.name ?? 'Broker'}
                </Badge>
                <Badge variant={trade.status === 'OPEN' ? 'open' : 'closed'}>
                  {trade.status}
                </Badge>
                {tradeMapped.strategyName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
                    <Tag className="w-2.5 h-2.5" />
                    {tradeMapped.strategyName}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                Portfolio Owner:{' '}
                <span className="font-semibold text-[var(--foreground)]">
                  {trade.portfolio_owner?.display_name}
                </span>{' '}
                ({trade.portfolio_owner?.relationship_label})
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] uppercase tracking-wider text-[var(--muted)] block font-semibold">
                Net Realized Return
              </span>
              <PnlDisplay value={trade.net_pnl} percentage={returnPct} size="xl" showIcon />

              {/* Realized R Badge */}
              {realizedR != null && rOutcome && (
                <div className="mt-1.5 flex items-center justify-end gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-xs font-bold font-mono ${rOutcomeStyles[rOutcome] ?? ''}`}>
                    {realizedR >= 0 ? '+' : ''}
                    {realizedR.toFixed(2)}R
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {rOutcome.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[var(--border)] text-xs font-mono">
            <div>
              <span className="text-[10px] text-[var(--muted)] uppercase block">Quantity</span>
              <span className="text-sm font-bold">{trade.quantity} shares</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--muted)] uppercase block">Entry Price</span>
              <span className="text-sm font-bold">{formatINR(trade.entry_price)}</span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--muted)] uppercase block">Exit Price</span>
              <span className="text-sm font-bold">
                {trade.exit_price ? formatINR(trade.exit_price) : 'OPEN'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[var(--muted)] uppercase block">Total Turnover</span>
              <span className="text-sm font-bold">{formatINR(turnover)}</span>
            </div>
          </div>
        </div>

        {/* ── RISK & R-MULTIPLE SECTION ──────────────────────────────── */}
        {tradeMapped.initialStopLoss && (
          <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Risk Management & R-Multiples
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Stop-loss tracking, risk definition, and outcome classification
                </p>
              </div>
            </div>

            <StopLossManager
              trade={tradeMapped}
              stopHistory={stopHistory}
              isAdmin={isAdmin}
            />

            {/* Closed Trade R-Summary */}
            {trade.status === 'CLOSED' && tradeMapped.realizedRMultiple !== null && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="text-center">
                  <span className="text-[10px] text-[var(--muted)] uppercase block font-semibold">Initial 1R</span>
                  <span className="text-sm font-bold text-rose-400">
                    {formatINR(tradeMapped.initialRiskRupees ?? 0)}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-[var(--muted)] uppercase block font-semibold">Gross R</span>
                  <span className={`text-sm font-bold ${(tradeMapped.grossRMultiple ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(tradeMapped.grossRMultiple ?? 0) >= 0 ? '+' : ''}
                    {(tradeMapped.grossRMultiple ?? 0).toFixed(2)}R
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-[var(--muted)] uppercase block font-semibold">Net R</span>
                  <span className={`text-sm font-bold ${realizedR != null && realizedR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {realizedR != null && realizedR >= 0 ? '+' : ''}
                    {realizedR != null ? realizedR.toFixed(2) : '—'}R
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-[var(--muted)] uppercase block font-semibold">Outcome</span>
                  <span className={`text-xs font-bold capitalize ${rOutcome ? (rOutcomeStyles[rOutcome] ?? '').split(' ')[0] : ''}`}>
                    {rOutcome?.replace('_', ' ') ?? '—'}
                  </span>
                </div>
              </div>
            )}

            {/* MAE / MFE if recorded */}
            {(tradeMapped.maxAdverseExcursion || tradeMapped.maxFavorableExcursion) && (
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                {tradeMapped.maxAdverseExcursion && (
                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                    <span className="text-[10px] text-rose-400 uppercase font-semibold block">
                      Max Adverse Excursion
                    </span>
                    <span className="font-bold text-rose-400">
                      ₹{tradeMapped.maxAdverseExcursion.toFixed(2)}
                    </span>
                  </div>
                )}
                {tradeMapped.maxFavorableExcursion && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 uppercase font-semibold block">
                      Max Favorable Excursion
                    </span>
                    <span className="font-bold text-emerald-400">
                      ₹{tradeMapped.maxFavorableExcursion.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Planned Target */}
            {tradeMapped.plannedTarget && (
              <div className="flex items-center gap-2 text-xs">
                <Target className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[var(--muted)]">Planned target:</span>
                <span className="font-bold font-mono text-purple-400">
                  ₹{tradeMapped.plannedTarget.toFixed(2)}
                </span>
                {tradeMapped.plannedRR && (
                  <span className="text-[var(--muted)]">
                    (1:{tradeMapped.plannedRR.toFixed(1)} R:R)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Itemized Statutory & Broker Charges Snapshot */}
        <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Itemized Charges Breakdown
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Statutory charges, broker commissions, and depository fees
                </p>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] text-[var(--muted)] uppercase block">
                Total Expenses
              </span>
              <span className="text-base font-bold text-amber-500">
                {formatINR(trade.total_charges)}
              </span>
            </div>
          </div>

          <div className="divide-y divide-[var(--border)] text-xs font-mono">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--foreground)]">Brokerage Fee</span>
              <span className="font-semibold">{formatINR(breakdown.brokerage ?? 0)}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[var(--foreground)] block">Securities Transaction Tax (STT)</span>
                <span className="text-[10px] text-[var(--muted)] font-sans">
                  {trade.trade_type === 'INTRADAY' ? '0.025% on sell' : '0.1% on buy & sell'}
                </span>
              </div>
              <span className="font-semibold">{formatINR(breakdown.stt ?? 0)}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--foreground)]">Exchange Transaction Charges</span>
              <span className="font-semibold">{formatINR(breakdown.exchangeCharges ?? 0)}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <div>
                <span className="text-[var(--foreground)] block">GST (18%)</span>
                <span className="text-[10px] text-[var(--muted)] font-sans">
                  On brokerage + exchange txn + SEBI charges
                </span>
              </div>
              <span className="font-semibold">{formatINR(breakdown.gst ?? 0)}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--foreground)]">SEBI Turnover Charges</span>
              <span className="font-semibold">{formatINR(breakdown.sebiCharges ?? 0)}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-[var(--foreground)]">Stamp Duty</span>
              <span className="font-semibold">{formatINR(breakdown.stampDuty ?? 0)}</span>
            </div>
            {breakdown.dpCharges > 0 && (
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[var(--foreground)] block">DP Charges (Depository)</span>
                  <span className="text-[10px] text-[var(--muted)] font-sans">
                    Charged on delivery sell per scrip
                  </span>
                </div>
                <span className="font-semibold">{formatINR(breakdown.dpCharges)}</span>
              </div>
            )}
            {breakdown.ipft > 0 && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--foreground)]">Investor Protection Fund (IPFT)</span>
                <span className="font-semibold">{formatINR(breakdown.ipft)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps & Notes */}
        <div className="p-5 rounded-2xl bg-[var(--background)] border border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--muted)]">Execution Timing</span>
            <div className="text-[var(--foreground)]">
              <div>Entry: {formatDate(trade.entry_at, { includeTime: true })}</div>
              <div>Exit: {trade.exit_at ? formatDate(trade.exit_at, { includeTime: true }) : 'Still Open'}</div>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-[var(--muted)]">Notes</span>
            <div className="text-[var(--muted)] italic">
              {trade.notes || 'No trade notes recorded.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
