'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  History,
  Clock,
  Target,
  Receipt,
  Heart,
  Sparkles,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Coins,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { KPICard } from '@/components/dashboard/KPICard';
import type { ChartDataPoint } from '@/components/charts/PortfolioChart';
import { RecentTradesList } from '@/components/dashboard/RecentTradesList';
import { useUser } from '@/components/providers/UserContext';
import { useCapitalData } from '@/lib/hooks/useCapitalData';
import { formatDate, formatINR } from '@/lib/utils';
import type { Trade, MonthlyPnl } from '@/types/app';
import type { HouseholdCapitalSummary } from '@/types/capital';

// Lazy-load charts and modals to keep initial bundle light
const PortfolioChart = dynamic(
  () => import('@/components/charts/PortfolioChart').then((m) => m.PortfolioChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-3xl bg-[var(--card)] animate-pulse flex items-center justify-center text-xs text-[var(--muted)]">
        Loading performance chart...
      </div>
    ),
  }
);

const MonthlyBarChart = dynamic(
  () => import('@/components/charts/MonthlyBarChart').then((m) => m.MonthlyBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-3xl bg-[var(--card)] animate-pulse flex items-center justify-center text-xs text-[var(--muted)]">
        Loading monthly breakdown...
      </div>
    ),
  }
);

const AddMoneyModal = dynamic(
  () => import('@/components/capital/AddMoneyModal').then((m) => m.AddMoneyModal),
  { ssr: false }
);

const WithdrawMoneyModal = dynamic(
  () => import('@/components/capital/WithdrawMoneyModal').then((m) => m.WithdrawMoneyModal),
  { ssr: false }
);

const SetInitialCapitalModal = dynamic(
  () => import('@/components/capital/SetInitialCapitalModal').then((m) => m.SetInitialCapitalModal),
  { ssr: false }
);

const ImportGeminiMilestonesModal = dynamic(
  () => import('@/components/trades/ImportGeminiMilestonesModal').then((m) => m.ImportGeminiMilestonesModal),
  { ssr: false }
);

interface DashboardClientProps {
  initialTrades: Trade[];
  capitalSummary?: HouseholdCapitalSummary;
  isAdmin?: boolean;
}

export function DashboardClient({
  initialTrades,
  capitalSummary,
  isAdmin: isAdminProp,
}: DashboardClientProps) {
  const router = useRouter();
  const { selectedPersonId, getPersonLabel, isAdmin: isAdminCtx } = useUser();
  const isAdmin = isAdminProp ?? isAdminCtx;

  const {
    summary,
    husbandSummary,
    wifeSummary,
    currentViewData,
    invalidateCapitalCache,
  } = useCapitalData(capitalSummary);

  const [showAddMoney, setShowAddMoney] = useState(false);
  const [showWithdrawMoney, setShowWithdrawMoney] = useState(false);
  const [showSetInitialCapital, setShowSetInitialCapital] = useState(false);
  const [showGeminiImport, setShowGeminiImport] = useState(false);

  // Filter trades based on selected person
  const filteredTrades = useMemo(() => {
    if (selectedPersonId === 'combined') {
      return initialTrades;
    }
    return initialTrades.filter((t) => t.portfolioOwnerId === selectedPersonId);
  }, [initialTrades, selectedPersonId]);

  // Compute trade KPIs (No R-Multiples!)
  const kpis = useMemo(() => {
    const closedTrades = filteredTrades.filter((t) => t.status === 'CLOSED');
    const openTrades = filteredTrades.filter((t) => t.status === 'OPEN');

    let totalRealizedNetPnl = 0;
    let totalChargesPaid = 0;
    let winningTrades = 0;
    let losingTrades = 0;

    closedTrades.forEach((t) => {
      const net = t.netPnl ?? 0;
      totalRealizedNetPnl += net;
      totalChargesPaid += t.totalCharges ?? 0;
      if (net > 0) winningTrades += 1;
      else if (net < 0) losingTrades += 1;
    });

    const totalResolved = winningTrades + losingTrades;
    const winRate = totalResolved > 0 ? (winningTrades / totalResolved) * 100 : 0;

    return {
      totalRealizedNetPnl,
      totalClosedTrades: closedTrades.length,
      totalOpenPositions: openTrades.length,
      winRate,
      totalChargesPaid,
      winningTrades,
      losingTrades,
    };
  }, [filteredTrades]);

  // Compute cumulative equity data for PortfolioChart
  const chartData: ChartDataPoint[] = useMemo(() => {
    const closedTrades = [...filteredTrades]
      .filter((t) => t.status === 'CLOSED' && t.exitAt)
      .sort((a, b) => new Date(a.exitAt!).getTime() - new Date(b.exitAt!).getTime());

    let cumNet = 0;
    let cumGross = 0;

    return closedTrades.map((t) => {
      const net = t.netPnl ?? 0;
      const gross = t.grossPnl ?? 0;
      cumNet += net;
      cumGross += gross;

      return {
        date: formatDate(t.exitAt),
        netPnl: net,
        grossPnl: gross,
        charges: t.totalCharges ?? 0,
        cumulativeNetPnl: Math.round(cumNet * 100) / 100,
        cumulativeGrossPnl: Math.round(cumGross * 100) / 100,
      };
    });
  }, [filteredTrades]);

  // Compute monthly breakdown data for MonthlyBarChart
  const monthlyData: MonthlyPnl[] = useMemo(() => {
    const closedTrades = filteredTrades.filter(
      (t) => t.status === 'CLOSED' && t.exitAt
    );

    const monthMap = new Map<string, MonthlyPnl>();

    closedTrades.forEach((t) => {
      const date = new Date(t.exitAt!);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
      });

      const existing = monthMap.get(key) ?? {
        year,
        month,
        label,
        grossPnl: 0,
        netPnl: 0,
        totalCharges: 0,
        tradeCount: 0,
        winCount: 0,
        lossCount: 0,
      };

      const net = t.netPnl ?? 0;
      existing.grossPnl += t.grossPnl ?? 0;
      existing.netPnl += net;
      existing.totalCharges += t.totalCharges ?? 0;
      existing.tradeCount += 1;
      if (net > 0) existing.winCount += 1;
      else if (net < 0) existing.lossCount += 1;

      monthMap.set(key, existing);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [filteredTrades]);

  const activeLabel = getPersonLabel(selectedPersonId);
  const isCombined = selectedPersonId === 'combined';

  const handleMutationSuccess = () => {
    invalidateCapitalCache();
    router.refresh();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto transition-all duration-300">
      {/* Portfolio overview header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-rose-500 font-semibold text-xs tracking-wider uppercase flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-current" />
              {activeLabel} Account View
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Trading &amp; Profit Dashboard
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Tracking invested capital, realized profits, and Gemini-provided trade milestones
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowGeminiImport(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-[var(--card)] hover:bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] font-semibold text-xs transition-colors shadow-sm"
              title="Import Gemini Milestones"
            >
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Import Gemini</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddMoney(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>Add Money</span>
            </button>
            <button
              type="button"
              onClick={() => setShowWithdrawMoney(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>Withdraw</span>
            </button>
            <Link
              href="/trades/new"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Trade</span>
            </Link>
          </div>
        )}
      </div>

      {/* ── 1. The 3 Primary Profit & Capital Cards ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Invested Capital */}
        <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-2 hover:border-rose-300 dark:hover:border-rose-900/40 card-hover animate-slide-up stagger-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              Invested Capital
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono text-[var(--foreground)] tabular-nums">
            {formatINR(currentViewData.investedCapital)}
          </p>
          <div className="text-[11px] text-[var(--muted)] pt-1 flex items-center justify-between border-t border-[var(--border)] mt-2">
            {isCombined ? (
              <>
                <span>Husband: {formatINR(husbandSummary?.investedCapital ?? 0)}</span>
                <span>Wife: {formatINR(wifeSummary?.investedCapital ?? 0)}</span>
              </>
            ) : (
              <span>Initial: {formatINR(currentViewData.initialCapital)}</span>
            )}
          </div>
        </div>

        {/* Available Profit for Withdrawal */}
        <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-2 hover:border-rose-300 dark:hover:border-rose-900/40 card-hover animate-slide-up stagger-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              Available Profit
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono text-emerald-500 dark:text-emerald-400 tabular-nums">
            {formatINR(currentViewData.availableProfit)}
          </p>
          <div className="text-[11px] text-[var(--muted)] pt-1 flex items-center justify-between border-t border-[var(--border)] mt-2">
            {isCombined ? (
              <>
                <span>Husband: {formatINR(husbandSummary?.availableProfit ?? 0)}</span>
                <span>Wife: {formatINR(wifeSummary?.availableProfit ?? 0)}</span>
              </>
            ) : (
              <span>Withdrawn: {formatINR(currentViewData.profitWithdrawn)}</span>
            )}
          </div>
        </div>

        {/* All-time Net Realized Profit */}
        <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-2 hover:border-rose-300 dark:hover:border-rose-900/40 card-hover animate-slide-up stagger-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              All-Time Realized Profit
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-3xl font-bold font-mono tabular-nums ${
              currentViewData.allTimeProfit >= 0
                ? 'text-emerald-500 dark:text-emerald-400'
                : 'text-rose-500 dark:text-rose-400'
            }`}
          >
            {currentViewData.allTimeProfit >= 0 ? '+' : ''}
            {formatINR(currentViewData.allTimeProfit)}
          </p>
          <div className="text-[11px] text-[var(--muted)] pt-1 flex items-center justify-between border-t border-[var(--border)] mt-2">
            {isCombined ? (
              <>
                <span>Husband: {formatINR(husbandSummary?.allTimeProfit ?? 0)}</span>
                <span>Wife: {formatINR(wifeSummary?.allTimeProfit ?? 0)}</span>
              </>
            ) : (
              <span>Lifetime closed trades P&amp;L</span>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Trade Statistics Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Win Rate"
          value={`${kpis.winRate.toFixed(1)}%`}
          icon={Target}
          subtitle={`${kpis.winningTrades}W / ${kpis.losingTrades}L`}
        />
        <KPICard
          title="Closed Trades"
          value={kpis.totalClosedTrades}
          icon={History}
        />
        <KPICard
          title="Open Positions"
          value={kpis.totalOpenPositions}
          icon={Clock}
        />
        <KPICard
          title="Total Charges Paid"
          value={kpis.totalChargesPaid}
          isCurrency
          icon={Receipt}
          variant="neutral"
        />
      </div>

      {/* ── 3. Charts Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioChart data={chartData} />
        <MonthlyBarChart data={monthlyData} />
      </div>

      {/* ── 4. Recent Trades Section ──────────────────────────────────────── */}
      <RecentTradesList trades={filteredTrades} />

      {/* ── 5. Admin Modals ──────────────────────────────────────────────── */}
      {isAdmin && (
        <>
          <AddMoneyModal
            open={showAddMoney}
            onClose={() => setShowAddMoney(false)}
            onSuccess={handleMutationSuccess}
            preselectedOwnerId={selectedPersonId !== 'combined' ? selectedPersonId : undefined}
          />
          <WithdrawMoneyModal
            open={showWithdrawMoney}
            onClose={() => setShowWithdrawMoney(false)}
            onSuccess={handleMutationSuccess}
            summary={summary || capitalSummary}
            preselectedOwnerId={selectedPersonId !== 'combined' ? selectedPersonId : undefined}
          />
          <SetInitialCapitalModal
            open={showSetInitialCapital}
            onClose={() => setShowSetInitialCapital(false)}
            onSuccess={handleMutationSuccess}
            husbandInitial={husbandSummary?.initialCapital ?? 0}
            wifeInitial={wifeSummary?.initialCapital ?? 0}
            husbandId={husbandSummary?.portfolioOwnerId}
            wifeId={wifeSummary?.portfolioOwnerId}
          />
          <ImportGeminiMilestonesModal
            open={showGeminiImport}
            onClose={() => setShowGeminiImport(false)}
            onSuccess={handleMutationSuccess}
            availableTrades={initialTrades.map((t) => ({
              id: t.id,
              symbol: t.symbol,
              entryPrice: t.entryPrice,
              status: t.status,
            }))}
          />
        </>
      )}
    </div>
  );
}
