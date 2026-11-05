'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Percent,
  Wallet,
  Receipt,
  Scale,
  Users,
  Building2,
  Layers,
  Target,
  Activity,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { KPICard } from '@/components/dashboard/KPICard';
import { MonthlyBarChart } from '@/components/charts/MonthlyBarChart';
import { Badge } from '@/components/ui/Badge';
import { PnlDisplay } from '@/components/ui/PnlDisplay';
import { useUser } from '@/components/providers/UserContext';
import { formatINR, cn } from '@/lib/utils';
import {
  bucketRMultiples,
  calculateRExpectancy,
} from '@/lib/calculations/r-multiple';
import type { Trade, MonthlyPnl } from '@/types/app';

interface AnalyticsClientProps {
  initialTrades: Trade[];
}

export function AnalyticsClient({ initialTrades }: AnalyticsClientProps) {
  const { persons, getPersonLabel, selectedPersonId } = useUser();
  const [timeframe, setTimeframe] = useState<'all' | 'fy' | 'cy'>('all');

  // Filter trades based on selected person
  const personTrades = useMemo(() => {
    if (selectedPersonId === 'combined') return initialTrades;
    return initialTrades.filter((t) => t.portfolioOwnerId === selectedPersonId);
  }, [initialTrades, selectedPersonId]);

  // Closed trades
  const closedTrades = useMemo(() => {
    return personTrades.filter((t) => t.status === 'CLOSED');
  }, [personTrades]);

  // Overall statistics
  const stats = useMemo(() => {
    let grossPnl = 0;
    let totalCharges = 0;
    let netPnl = 0;
    let winSum = 0;
    let lossSum = 0;
    let winCount = 0;
    let lossCount = 0;

    closedTrades.forEach((t) => {
      const net = t.netPnl ?? 0;
      grossPnl += t.grossPnl ?? 0;
      totalCharges += t.totalCharges ?? 0;
      netPnl += net;

      if (net > 0) {
        winSum += net;
        winCount += 1;
      } else if (net < 0) {
        lossSum += Math.abs(net);
        lossCount += 1;
      }
    });

    const totalResolved = winCount + lossCount;
    const winRate = totalResolved > 0 ? (winCount / totalResolved) * 100 : 0;
    const avgWin = winCount > 0 ? winSum / winCount : 0;
    const avgLoss = lossCount > 0 ? lossSum / lossCount : 0;
    const profitFactor = lossSum > 0 ? winSum / lossSum : winSum > 0 ? 99.9 : 0;

    return {
      grossPnl,
      totalCharges,
      netPnl,
      totalTrades: closedTrades.length,
      winCount,
      lossCount,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
    };
  }, [closedTrades]);

  // R-Multiple Analytics
  const rStats = useMemo(() => {
    const tradesWithR = closedTrades.filter(
      (t) => t.realizedRMultiple != null && t.initialRiskRupees != null && t.initialRiskRupees > 0
    );

    if (tradesWithR.length === 0) return null;

    const rValues = tradesWithR.map((t) => t.realizedRMultiple!);
    const avgR = rValues.reduce((a, b) => a + b, 0) / rValues.length;

    const winRValues = rValues.filter((r) => r > 0);
    const lossRValues = rValues.filter((r) => r < 0);

    const avgWinR = winRValues.length > 0
      ? winRValues.reduce((a, b) => a + b, 0) / winRValues.length
      : 0;
    const avgLossR = lossRValues.length > 0
      ? Math.abs(lossRValues.reduce((a, b) => a + b, 0) / lossRValues.length)
      : 0;

    const winRate = rValues.length > 0 ? winRValues.length / rValues.length : 0;
    const expectancy = calculateRExpectancy(winRate, avgWinR, avgLossR);

    // R Distribution histogram
    const distribution = bucketRMultiples(rValues);

    // Strategy performance breakdown
    const strategyMap = new Map<string, { rValues: number[]; trades: number }>();
    tradesWithR.forEach((t) => {
      const key = t.strategyName ?? 'Untagged';
      const existing = strategyMap.get(key) ?? { rValues: [], trades: 0 };
      existing.rValues.push(t.realizedRMultiple!);
      existing.trades += 1;
      strategyMap.set(key, existing);
    });

    const strategyPerformance = Array.from(strategyMap.entries())
      .map(([name, data]) => ({
        name,
        avgR: data.rValues.reduce((a, b) => a + b, 0) / data.rValues.length,
        trades: data.trades,
        winRate:
          (data.rValues.filter((r) => r > 0).length / data.rValues.length) * 100,
      }))
      .sort((a, b) => b.avgR - a.avgR);

    return {
      count: tradesWithR.length,
      avgR,
      avgWinR,
      avgLossR,
      expectancy,
      distribution,
      strategyPerformance,
    };
  }, [closedTrades]);

  // Broker Comparison (Kite vs Shoonya)
  const brokerStats = useMemo(() => {
    const kiteTrades = closedTrades.filter((t) => t.broker?.code === 'KITE');
    const shoonyaTrades = closedTrades.filter((t) => t.broker?.code === 'SHOONYA');

    const kiteNet = kiteTrades.reduce((acc, t) => acc + (t.netPnl ?? 0), 0);
    const kiteCharges = kiteTrades.reduce((acc, t) => acc + (t.totalCharges ?? 0), 0);

    const shoonyaNet = shoonyaTrades.reduce((acc, t) => acc + (t.netPnl ?? 0), 0);
    const shoonyaCharges = shoonyaTrades.reduce((acc, t) => acc + (t.totalCharges ?? 0), 0);

    return {
      kite: { trades: kiteTrades.length, net: kiteNet, charges: kiteCharges },
      shoonya: { trades: shoonyaTrades.length, net: shoonyaNet, charges: shoonyaCharges },
    };
  }, [closedTrades]);

  // Product Comparison (Intraday vs Delivery)
  const productStats = useMemo(() => {
    const intradayTrades = closedTrades.filter((t) => t.tradeType === 'INTRADAY');
    const deliveryTrades = closedTrades.filter((t) => t.tradeType === 'DELIVERY');

    const intradayNet = intradayTrades.reduce((acc, t) => acc + (t.netPnl ?? 0), 0);
    const deliveryNet = deliveryTrades.reduce((acc, t) => acc + (t.netPnl ?? 0), 0);

    return {
      intraday: { trades: intradayTrades.length, net: intradayNet },
      delivery: { trades: deliveryTrades.length, net: deliveryNet },
    };
  }, [closedTrades]);

  // Person Comparison (Husband vs Wife)
  const personComparison = useMemo(() => {
    return persons.map((person) => {
      const pTrades = initialTrades.filter(
        (t) => t.portfolioOwnerId === person.id && t.status === 'CLOSED'
      );
      const net = pTrades.reduce((acc, t) => acc + (t.netPnl ?? 0), 0);
      const charges = pTrades.reduce((acc, t) => acc + (t.totalCharges ?? 0), 0);
      const wins = pTrades.filter((t) => (t.netPnl ?? 0) > 0).length;
      const winRate = pTrades.length > 0 ? (wins / pTrades.length) * 100 : 0;

      return {
        id: person.id,
        label: getPersonLabel(person.id),
        trades: pTrades.length,
        net,
        charges,
        winRate,
      };
    });
  }, [initialTrades, persons, getPersonLabel]);

  // Monthly breakdown
  const monthlyData: MonthlyPnl[] = useMemo(() => {
    const monthMap = new Map<string, MonthlyPnl>();

    closedTrades.forEach((t) => {
      if (!t.exitAt) return;
      const date = new Date(t.exitAt);
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
  }, [closedTrades]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Portfolio Analytics & Breakdown
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Win rate ratios, profit factor, broker comparisons, and segment performance
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <KPICard
          title="Profit Factor"
          value={stats.profitFactor.toFixed(2)}
          subtitle={stats.profitFactor > 1.5 ? 'Excellent' : 'Moderate'}
          icon={Scale}
        />
        <KPICard
          title="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          subtitle={`${stats.winCount}W / ${stats.lossCount}L`}
          icon={Percent}
        />
        <KPICard
          title="Average Win"
          value={stats.avgWin}
          isCurrency
          variant="positive"
          icon={TrendingUp}
        />
        <KPICard
          title="Average Loss"
          value={stats.avgLoss}
          isCurrency
          variant="negative"
          icon={Receipt}
        />
      </div>

      {/* R-Multiple KPI Row */}
      {rStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-indigo-500/30 shadow-sm space-y-1 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Avg R-Multiple</span>
            </div>
            <div className={cn(
              'text-2xl font-bold font-mono',
              rStats.avgR >= 1 ? 'text-emerald-400'
                : rStats.avgR >= 0 ? 'text-lime-400'
                : rStats.avgR >= -1 ? 'text-orange-400'
                : 'text-rose-400'
            )}>
              {rStats.avgR >= 0 ? '+' : ''}{rStats.avgR.toFixed(2)}R
            </div>
            <div className="text-[11px] text-[var(--muted)]">{rStats.count} trades measured</div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-cyan-500/30 shadow-sm space-y-1 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">R-Expectancy</span>
            </div>
            <div className={cn(
              'text-2xl font-bold font-mono',
              rStats.expectancy > 0 ? 'text-emerald-400' : 'text-rose-400'
            )}>
              {rStats.expectancy >= 0 ? '+' : ''}{rStats.expectancy.toFixed(3)}R
            </div>
            <div className="text-[11px] text-[var(--muted)]">Expected return per trade in R</div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-emerald-500/20 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block">Avg Win R</span>
            <div className="text-2xl font-bold font-mono text-emerald-400">+{rStats.avgWinR.toFixed(2)}R</div>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--card)] border border-rose-500/20 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block">Avg Loss R</span>
            <div className="text-2xl font-bold font-mono text-rose-400">-{rStats.avgLossR.toFixed(2)}R</div>
          </div>
        </div>
      )}

      {/* Monthly chart */}
      <MonthlyBarChart data={monthlyData} />

      {/* R-Distribution Histogram */}
      {rStats && rStats.distribution.some((d) => d.count > 0) && (
        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)]">R-Multiple Distribution</h3>
              <p className="text-xs text-[var(--muted)]">How many closed trades fell in each R-multiple bucket</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={rStats.distribution.map((d) => ({
                name: d.bucket.label,
                count: d.count,
                fill: d.bucket.color,
              }))}
              margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 11,
                }}
                formatter={(value) => [`${value} trade${Number(value) !== 1 ? 's' : ''}`, 'Count']}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {rStats.distribution.map((entry, index) => (
                  <Cell key={index} fill={entry.bucket.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Strategy R-Performance */}
      {rStats && rStats.strategyPerformance.length > 0 && (
        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)]">Strategy R-Performance</h3>
              <p className="text-xs text-[var(--muted)]">Average R-multiple by strategy/setup name</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {rStats.strategyPerformance.map((s) => {
              const barWidth = Math.min(Math.abs(s.avgR) * 25, 100);
              return (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                      <span className="text-purple-400">#{s.name}</span>
                      <span className="text-[10px] text-[var(--muted)] font-normal">{s.trades} trades · {s.winRate.toFixed(0)}% win</span>
                    </span>
                    <span className={cn(
                      'font-bold font-mono text-xs',
                      s.avgR >= 1 ? 'text-emerald-400'
                        : s.avgR >= 0 ? 'text-lime-400'
                        : 'text-rose-400'
                    )}>
                      {s.avgR >= 0 ? '+' : ''}{s.avgR.toFixed(2)}R
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--background)] overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        s.avgR >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Segment Breakdown: Person Comparison, Broker Comparison, Product Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Person Comparison */}
        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-500" />
            <h3 className="font-bold text-sm text-[var(--foreground)]">
              Portfolio Breakdown
            </h3>
          </div>

          <div className="space-y-3">
            {personComparison.map((p) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1.5 font-mono text-xs"
              >
                <div className="flex justify-between items-center font-sans font-semibold text-[var(--foreground)]">
                  <span>{p.label}</span>
                  <span className="text-[11px] text-[var(--muted)] font-mono">
                    {p.trades} trades
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--muted)] text-[10px] uppercase">Net P&L:</span>
                  <PnlDisplay value={p.net} size="sm" />
                </div>
                <div className="flex justify-between items-center text-[11px] text-[var(--muted)]">
                  <span>Win Rate:</span>
                  <span className="font-semibold">{p.winRate.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Broker Comparison */}
        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-500" />
            <h3 className="font-bold text-sm text-[var(--foreground)]">
              Broker Analysis
            </h3>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center font-sans font-semibold text-[var(--foreground)]">
                <span className="flex items-center gap-1.5">
                  <Badge variant="kite">Zerodha Kite</Badge>
                </span>
                <span className="text-[11px] text-[var(--muted)] font-mono">
                  {brokerStats.kite.trades} trades
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)] text-[10px] uppercase">Net Return:</span>
                <PnlDisplay value={brokerStats.kite.net} size="sm" />
              </div>
              <div className="flex justify-between items-center text-[11px] text-[var(--muted)]">
                <span>Charges Paid:</span>
                <span className="text-amber-500 font-semibold">{formatINR(brokerStats.kite.charges)}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center font-sans font-semibold text-[var(--foreground)]">
                <span className="flex items-center gap-1.5">
                  <Badge variant="shoonya">Shoonya</Badge>
                </span>
                <span className="text-[11px] text-[var(--muted)] font-mono">
                  {brokerStats.shoonya.trades} trades
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)] text-[10px] uppercase">Net Return:</span>
                <PnlDisplay value={brokerStats.shoonya.net} size="sm" />
              </div>
              <div className="flex justify-between items-center text-[11px] text-[var(--muted)]">
                <span>Charges Paid:</span>
                <span className="text-amber-500 font-semibold">{formatINR(brokerStats.shoonya.charges)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Product Comparison */}
        <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h3 className="font-bold text-sm text-[var(--foreground)]">
              Product Analysis
            </h3>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center font-sans font-semibold text-[var(--foreground)]">
                <Badge variant="intraday">Intraday (MIS)</Badge>
                <span className="text-[11px] text-[var(--muted)] font-mono">
                  {productStats.intraday.trades} trades
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)] text-[10px] uppercase">Net Return:</span>
                <PnlDisplay value={productStats.intraday.net} size="sm" />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center font-sans font-semibold text-[var(--foreground)]">
                <Badge variant="delivery">Delivery (CNC)</Badge>
                <span className="text-[11px] text-[var(--muted)] font-mono">
                  {productStats.delivery.trades} trades
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)] text-[10px] uppercase">Net Return:</span>
                <PnlDisplay value={productStats.delivery.net} size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
