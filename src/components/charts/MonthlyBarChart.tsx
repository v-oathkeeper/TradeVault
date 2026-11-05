'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { formatINR, cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3 } from 'lucide-react';
import type { MonthlyPnl } from '@/types/app';

interface MonthlyBarChartProps {
  data: MonthlyPnl[];
  className?: string;
}

export function MonthlyBarChart({ data, className }: MonthlyBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn('p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]', className)}>
        <EmptyState
          icon={BarChart3}
          title="No monthly breakdown"
          description="Monthly profit and loss distribution will appear here once trades are recorded."
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[var(--foreground)]">
            Monthly Net P&L
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Month-over-month realized performance
          </p>
        </div>
      </div>

      <div className="h-[240px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
              opacity={0.5}
            />
            <XAxis
              dataKey="label"
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
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0]?.payload as MonthlyPnl;
                  return (
                    <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl text-xs space-y-1.5 font-sans min-w-[170px]">
                      <div className="font-semibold text-[var(--foreground)] border-b border-[var(--border)] pb-1">
                        {label}
                      </div>
                      <div className="flex justify-between gap-4 font-mono">
                        <span className="text-[var(--muted)]">Net P&L:</span>
                        <span
                          className={cn(
                            'font-semibold',
                            item.netPnl >= 0
                              ? 'text-[var(--positive)]'
                              : 'text-[var(--negative)]'
                          )}
                        >
                          {formatINR(item.netPnl, { showSign: true })}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono">
                        <span className="text-[var(--muted)]">Trades:</span>
                        <span>{item.tradeCount}</span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono">
                        <span className="text-[var(--muted)]">Win/Loss:</span>
                        <span>
                          <span className="text-emerald-500">{item.winCount}</span>
                          {' / '}
                          <span className="text-rose-500">{item.lossCount}</span>
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 font-mono">
                        <span className="text-[var(--muted)]">Charges:</span>
                        <span className="text-amber-500">
                          {formatINR(item.totalCharges)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="netPnl" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.netPnl >= 0 ? '#10B981' : '#EF4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
