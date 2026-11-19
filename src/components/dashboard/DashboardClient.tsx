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
import { SuccessCelebration } from '@/components/ui/SuccessCelebration';
import { useUser } from '@/components/providers/UserContext';
import { useCapitalData } from '@/lib/hooks/useCapitalData';
import { formatDate, formatINR } from '@/lib/utils';
import type { Trade, MonthlyPnl } from '@/types/app';
import type { HouseholdCapitalSummary } from '@/types/capital';

const monthKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
});
const monthLabelFormatter = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  year: '2-digit',
  timeZone: 'Asia/Kolkata',
});
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getDashboardRangeStart(dateRange: '1m' | '3m' | '6m' | '1y' | 'ytd', now: Date) {
  // Work with IST wall-clock parts represented as UTC so the filter boundary
  // stays correct even when the browser itself is configured for another zone.
  const istWallClock = new Date(now.getTime() + IST_OFFSET_MS);
  const year = istWallClock.getUTCFullYear();

  if (dateRange === 'ytd') {
    return new Date(Date.UTC(year, 0, 1) - IST_OFFSET_MS);
  }

  const months = dateRange === '1m' ? 1 : dateRange === '3m' ? 3 : dateRange === '6m' ? 6 : 12;
  const monthIndex = istWallClock.getUTCMonth() - months;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = ((monthIndex % 12) + 12) % 12;
  const targetDay = Math.min(
    istWallClock.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  );

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      istWallClock.getUTCHours(),
      istWallClock.getUTCMinutes(),
      istWallClock.getUTCSeconds(),
      istWallClock.getUTCMilliseconds()
    ) - IST_OFFSET_MS
  );
}

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

const ImportTradeModal = dynamic(
  () => import('@/components/trades/ImportTradeModal').then((m) => m.ImportTradeModal),
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
  const { selectedPersonId, getPersonLabel, dateRange, isAdmin: isAdminCtx } = useUser();
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
  const [showImportTrade, setShowImportTrade] = useState(false);
  const [showSaveCelebration, setShowSaveCelebration] = useState(false);

  // Apply the dashboard's portfolio and date filters consistently to its KPIs,
  // charts, and recent activity. Closed trades are dated by their exit; open
  // positions are dated by entry.
  const filteredTrades = useMemo(() => {
    const ownerTrades = selectedPersonId === 'combined'
      ? initialTrades
      : initialTrades.filter((t) => t.portfolioOwnerId === selectedPersonId);

    if (dateRange === 'all') return ownerTrades;

    const now = new Date();
    const rangeStart = getDashboardRangeStart(dateRange, now);

    return ownerTrades.filter((trade) => {
      const tradeDate = trade.status === 'CLOSED' && trade.exitAt ? trade.exitAt : trade.entryAt;
      const timestamp = new Date(tradeDate).getTime();
      return timestamp >= rangeStart.getTime() && timestamp <= now.getTime();
    });
  }, [initialTrades, selectedPersonId, dateRange]);

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
      const dateParts = monthKeyFormatter.formatToParts(date);
      const year = Number(dateParts.find((part) => part.type === 'year')?.value);
      const month = Number(dateParts.find((part) => part.type === 'month')?.value) - 1;
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const label = monthLabelFormatter.format(date);

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
    setShowSaveCelebration(true);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 transition-all duration-300 sm:p-6 lg:p-8">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] px-6 py-7 shadow-[var(--shadow-lg)] animate-fade-in sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 right-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              {activeLabel} portfolio
            </span>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--sidebar-fg)] sm:text-3xl">
                Your trading, in focus.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
                Capital, realized performance, and recent decisions in one clear view.
              </p>
            </div>
            <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3 text-[11px] font-medium text-white/75">
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                <Coins aria-hidden="true" className="h-4 w-4 animate-coin-bob" />
                <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 text-[10px] text-amber-300 animate-sparkle-pop">✦</span>
              </span>
              <span>Markets: dramatic. Your journal: receipts.</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImportTrade(true)}
                className="dashboard-action inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-[var(--sidebar-fg)] shadow-sm hover:border-white/25 hover:bg-white/10"
                title="Import Trade with Milestones"
              >
                <Sparkles className="dashboard-action-icon w-4 h-4 text-purple-300" />
                <span>Import Trade</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddMoney(true)}
                className="dashboard-action inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-400"
              >
                <ArrowUpCircle className="dashboard-action-icon w-4 h-4" />
                <span>Add Money</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSetInitialCapital(true)}
                className="dashboard-action inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-[var(--sidebar-fg)] shadow-sm hover:border-white/25 hover:bg-white/10"
              >
                <Wallet className="dashboard-action-icon w-4 h-4" />
                <span>Set Capital</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWithdrawMoney(true)}
                className="dashboard-action inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
              >
                <ArrowDownCircle className="dashboard-action-icon w-4 h-4" />
                <span>Withdraw</span>
              </button>
              <Link
                href="/trades/new"
                className="dashboard-action inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-950/30 hover:from-blue-400 hover:to-indigo-400"
              >
                <Plus className="dashboard-action-icon w-4 h-4" />
                <span>Record Trade</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── 1. The 3 Primary Profit & Capital Cards ──────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Invested Capital */}
        <div className="p-5 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-2 hover:border-blue-300 dark:hover:border-blue-900/40 card-hover animate-slide-up stagger-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">
              Invested Capital
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-bold font-mono text-[var(--foreground)] tabular-nums">
            {formatINR(currentViewData.investedCapital)}
          </p>
          <div className="text-[11px] text-[var(--muted)] pt-1 flex items-center justify-between border-t border-[var(--border)] mt-2">
            {isCombined ? (
              <>
                <span>{husbandSummary ? getPersonLabel(husbandSummary.portfolioOwnerId) : 'Portfolio 1'}: {formatINR(husbandSummary?.investedCapital ?? 0)}</span>
                <span>{wifeSummary ? getPersonLabel(wifeSummary.portfolioOwnerId) : 'Portfolio 2'}: {formatINR(wifeSummary?.investedCapital ?? 0)}</span>
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
                <span>{husbandSummary ? getPersonLabel(husbandSummary.portfolioOwnerId) : 'Portfolio 1'}: {formatINR(husbandSummary?.availableProfit ?? 0)}</span>
                <span>{wifeSummary ? getPersonLabel(wifeSummary.portfolioOwnerId) : 'Portfolio 2'}: {formatINR(wifeSummary?.availableProfit ?? 0)}</span>
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
                <span>{husbandSummary ? getPersonLabel(husbandSummary.portfolioOwnerId) : 'Portfolio 1'}: {formatINR(husbandSummary?.allTimeProfit ?? 0)}</span>
                <span>{wifeSummary ? getPersonLabel(wifeSummary.portfolioOwnerId) : 'Portfolio 2'}: {formatINR(wifeSummary?.allTimeProfit ?? 0)}</span>
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
          className="card-hover animate-slide-up stagger-1"
        />
        <KPICard
          title="Closed Trades"
          value={kpis.totalClosedTrades}
          icon={History}
          className="card-hover animate-slide-up stagger-2"
        />
        <KPICard
          title="Open Positions"
          value={kpis.totalOpenPositions}
          icon={Clock}
          className="card-hover animate-slide-up stagger-3"
        />
        <KPICard
          title="Total Charges Paid"
          value={kpis.totalChargesPaid}
          isCurrency
          icon={Receipt}
          variant="neutral"
          className="card-hover animate-slide-up stagger-4"
        />
      </div>

      {/* ── 3. Charts Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up stagger-4">
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
          <ImportTradeModal
            open={showImportTrade}
            onClose={() => setShowImportTrade(false)}
            onSuccess={handleMutationSuccess}
          />
        </>
      )}
      <SuccessCelebration
        open={showSaveCelebration}
        onComplete={() => setShowSaveCelebration(false)}
      />
    </div>
  );
}
