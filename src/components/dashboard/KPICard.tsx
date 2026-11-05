import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn, formatINR, formatPercent } from '@/lib/utils';
import { Skeleton } from '@/components/ui/LoadingSkeleton';

export type KPIVariant = 'default' | 'positive' | 'negative' | 'neutral';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  isCurrency?: boolean;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  variant?: KPIVariant;
  icon: LucideIcon;
  isLoading?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  isCurrency = false,
  trend,
  variant = 'default',
  icon: Icon,
  isLoading = false,
  className,
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-xl" />
        </div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }

  const numVal = typeof value === 'number' ? value : parseFloat(value);
  const effectiveVariant: KPIVariant =
    variant !== 'default'
      ? variant
      : !isNaN(numVal) && isCurrency
      ? numVal > 0
        ? 'positive'
        : numVal < 0
        ? 'negative'
        : 'neutral'
      : 'default';

  const iconBgStyles: Record<KPIVariant, string> = {
    default: 'bg-blue-500/10 text-blue-500',
    positive: 'bg-emerald-500/10 text-emerald-500',
    negative: 'bg-rose-500/10 text-rose-500',
    neutral: 'bg-slate-500/10 text-slate-500',
  };

  const valueColorStyles: Record<KPIVariant, string> = {
    default: 'text-[var(--foreground)]',
    positive: 'text-[var(--positive)]',
    negative: 'text-[var(--negative)]',
    neutral: 'text-[var(--muted)]',
  };

  const displayValue =
    typeof value === 'number'
      ? isCurrency
        ? formatINR(value, { showSign: effectiveVariant === 'positive' || effectiveVariant === 'negative' })
        : value.toLocaleString('en-IN')
      : value;

  return (
    <div
      className={cn(
        'p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm hover:border-[var(--border)]/80 transition-all flex flex-col justify-between',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </span>
        <div
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
            iconBgStyles[effectiveVariant]
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-1">
        <div
          className={cn(
            'text-2xl font-bold tracking-tight font-mono',
            valueColorStyles[effectiveVariant]
          )}
        >
          {displayValue}
        </div>

        {(subtitle || trend) && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 font-medium font-mono',
                  trend.isPositive ?? trend.value >= 0
                    ? 'text-[var(--positive)]'
                    : 'text-[var(--negative)]'
                )}
              >
                {(trend.isPositive ?? trend.value >= 0) ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {formatPercent(Math.abs(trend.value))}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
