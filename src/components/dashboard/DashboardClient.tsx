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
  Shield,
  Activity,
  UploadCloud,
  Plus,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { KPICard } from '@/components/dashboard/KPICard';
import type { ChartDataPoint } from '@/components/charts/PortfolioChart';
import { RecentTradesList } from '@/components/dashboard/RecentTradesList';
import { useUser } from '@/components/providers/UserContext';
import { formatDate, formatINR } from '@/lib/utils';
import type { Trade, MonthlyPnl } from '@/types/app';

// Lazy-load heavy Recharts visualizers and modals to keep initial bundle ultra-light
const PortfolioChart = dynamic(
  () => import('@/components/charts/PortfolioChart').then((m) => m.PortfolioChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-2xl bg-[var(--background)] animate-pulse flex items-center justify-center text-xs text-[var(--muted)]">
        Loading equity chart...
      </div>
    ),
  }
);

const MonthlyBarChart = dynamic(
  () => import('@/components/charts/MonthlyBarChart').then((m) => m.MonthlyBarChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-2xl bg-[var(--background)] animate-pulse flex items-center justify-center text-xs text-[var(--muted)]">
        Loading monthly breakdown...
      </div>
    ),
  }
);

const ImportTradeModal = dynamic(
  () => import('@/components/trades/ImportTradeModal').then((m) => m.ImportTradeModal),
  { ssr: false }
);

interface DashboardClientProps {
  initialTrades: Trade[];
}

export function DashboardClient({ initialTrades }: DashboardClientProps) {
  const router = useRouter();
  const { selectedPersonId, getPersonLabel, persons, isAdmin } = useUser();
  const [showImportModal, setShowImportModal] = useState(false);

  // Filter trades based on selected person
  const filteredTrades = useMemo(() => {
    if (selectedPersonId === 'combined') {
      return initialTrades;
    }
    return initialTrades.filter((t) => t.portfolioOwnerId === selectedPersonId);
  }, [initialTrades, selectedPersonId]);

  // Compute KPIs
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

    // Unrealized gross/net estimation for open positions
    let currentUnrealizedNetPnl = 0;
    openTrades.forEach((t) => {
      // If current price available, calculate unrealized
      const currentPrice = (t as any).currentPrice ?? t.entryPrice;
      const gross =
        t.direction === 'LONG'
          ? (currentPrice - t.entryPrice) * t.quantity
          : (t.entryPrice - currentPrice) * t.quantity;
      currentUnrealizedNetPnl += gross; // simplified without exit charges
    });

    let totalR = 0;
    let rCount = 0;
    closedTrades.forEach((t) => {
      if (t.realizedRMultiple != null) {
        totalR += t.realizedRMultiple;
        rCount += 1;
      }
    });
    const avgRMultiple = rCount > 0 ? totalR / rCount : null;

    let totalOpenRisk = 0;
    openTrades.forEach((t) => {
      if (t.initialRiskRupees != null) {
        totalOpenRisk += t.initialRiskRupees;
      }
    });

    return {
      totalRealizedNetPnl,
      currentUnrealizedNetPnl,
      totalClosedTrades: closedTrades.length,
      totalOpenPositions: openTrades.length,
      winRate,
      totalChargesPaid,
      winningTrades,
      losingTrades,
      avgRMultiple,
      totalOpenRisk,
      rCount,
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
      const month = date.getMonth(); // 0-11
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Portfolio overview header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            {activeLabel} Portfolio Performance
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Real-time equity analytics, net returns, and broker expense metrics
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--card)] hover:bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] font-semibold text-xs transition-colors shadow-sm"
            >
              <UploadCloud className="w-4 h-4 text-blue-500" />
              <span>Import Trade</span>
            </button>
            <Link
              href="/trades/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Trade</span>
            </Link>
          </div>
        )}
      </div>

      {/* 6 Core KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <KPICard
          title="Realized Net P&L"
          value={kpis.totalRealizedNetPnl}
          isCurrency
          icon={Wallet}
        />
        <KPICard
          title="Unrealized P&L"
          value={kpis.currentUnrealizedNetPnl}
          isCurrency
          icon={TrendingUp}
          subtitle="Open positions"
        />
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
          title="Total Charges"
          value={kpis.totalChargesPaid}
          isCurrency
          icon={Receipt}
          variant="neutral"
        />
      </div>

      {/* R-Multiple Risk & Performance Summary Strip */}
      {(kpis.avgRMultiple !== null || kpis.totalOpenRisk > 0) && (
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
          {kpis.avgRMultiple !== null && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                  Avg Realized R ({kpis.rCount} trades)
                </span>
                <span className={`text-base font-bold ${kpis.avgRMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {kpis.avgRMultiple >= 0 ? '+' : ''}{kpis.avgRMultiple.toFixed(2)}R
                </span>
              </div>
            </div>
          )}
          {kpis.totalOpenRisk > 0 && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] text-rose-400 uppercase font-semibold block">
                  Open Risk at Stake
                </span>
                <span className="text-base font-bold text-rose-400">
                  {formatINR(kpis.totalOpenRisk)}
                </span>
              </div>
            </div>
          )}
          <div className="hidden lg:flex items-center justify-end text-[11px] text-[var(--muted)] font-sans">
            <span>R = Initial 1R Risk Per Trade Unit</span>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PortfolioChart data={chartData} />
        <MonthlyBarChart data={monthlyData} />
      </div>

      {/* Recent Trades Section */}
      <RecentTradesList trades={filteredTrades} />

      {/* Import Trade Modal */}
      <ImportTradeModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
