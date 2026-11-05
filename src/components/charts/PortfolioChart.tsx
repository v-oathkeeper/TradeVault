'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatINR, cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { LineChart as ChartIcon } from 'lucide-react';

export interface ChartDataPoint {
  date: string; // YYYY-MM-DD or readable
  netPnl: number;
  grossPnl: number;
  charges: number;
  cumulativeNetPnl: number;
  cumulativeGrossPnl: number;
}

interface PortfolioChartProps {
  data: ChartDataPoint[];
  className?: string;
}

export function PortfolioChart({ data, className }: PortfolioChartProps) {
  const [metric, setMetric] = useState<'cumulativeNetPnl' | 'cumulativeGrossPnl' | 'charges'>(
    'cumulativeNetPnl'
  );

  if (!data || data.length === 0) {
    return (
      <div className={cn('p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]', className)}>
        <EmptyState
          icon={ChartIcon}
          title="No trading history yet"
          description="Record your first closed trade to see your cumulative equity curve and performance chart."
        />
      </div>
    );
  }

  const latestVal = data[data.length - 1]?.[metric] ?? 0;
  const isPositive = latestVal >= 0;
  const strokeColor =
    metric === 'charges'
      ? '#F59E0B' // amber
      : isPositive
      ? '#10B981' // emerald
      : '#EF4444'; // rose

  const fillColor =
    metric === 'charges'
      ? 'rgba(245, 158, 11, 0.15)'
      : isPositive
      ? 'rgba(16, 185, 129, 0.15)'
      : 'rgba(239, 68, 68, 0.15)';

  return (
    <div
      className={cn(
        'p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)]">
            Cumulative Equity Curve
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Performance over closed trades
          </p>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetric('cumulativeNetPnl')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-all',
              metric === 'cumulativeNetPnl'
                ? 'bg-[var(--card)] text-blue-500 font-semibold shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            Net P&L
          </button>
          <button
            type="button"
            onClick={() => setMetric('cumulativeGrossPnl')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-all',
              metric === 'cumulativeGrossPnl'
                ? 'bg-[var(--card)] text-blue-500 font-semibold shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            Gross P&L
          </button>
          <button
            type="button"
            onClick={() => setMetric('charges')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-all',
              metric === 'charges'
                ? 'bg-[var(--card)] text-amber-500 font-semibold shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            Total Charges
          </button>
        </div>
      </div>

      <div className="h-[280px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
              opacity={0.5}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              dy={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--muted)' }}
              tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              dx={-5}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0]?.payload as ChartDataPoint;
                  return (
                    <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl text-xs space-y-1.5 font-sans min-w-[160px]">
                      <div className="font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-1">
                        {label}
                      </div>
                      <div className="flex justify-between gap-4 font-mono">
                        <span className="text-[var(--muted)]">Net P&L:</span>
                        <span
                          className={cn(
                            'font-semibold',
                            item.cumulativeNetPnl >= 0
                              ? 'text-[var(--positive)]'
                              : 'text-[var(--negative)]'
                          )}
                        >
                          {formatINR(item.cumulativeNetPnl, { showSign: true })}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono">
                        <span className="text-[var(--muted)]">Gross P&L:</span>
                        <span>{formatINR(item.cumulativeGrossPnl)}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono">
                        <span className="text-[var(--muted)]">Charges:</span>
                        <span className="text-amber-500">
                          {formatINR(item.charges)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={strokeColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#equityGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
