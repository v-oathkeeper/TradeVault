import React from 'react';
import { cn, formatINR, formatPercent } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PnlDisplayProps {
  value: number | null | undefined;
  percentage?: number | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showIcon?: boolean;
  showSign?: boolean;
  compact?: boolean;
}

export function PnlDisplay({
  value,
  percentage,
  className,
  size = 'md',
  showIcon = false,
  showSign = true,
  compact = false,
}: PnlDisplayProps) {
  if (value === null || value === undefined) {
    return <span className="text-[var(--muted)] font-mono">—</span>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  const sizeClasses = {
    sm: 'text-sm font-medium',
    md: 'text-base font-semibold',
    lg: 'text-xl font-bold',
    xl: 'text-3xl font-extrabold',
  }[size];

  const colorClass = isPositive
    ? 'text-[var(--positive)]'
    : isNegative
    ? 'text-[var(--negative)]'
    : 'text-[var(--muted)]';

  return (
    <div className={cn('inline-flex items-baseline gap-1.5 font-mono', className)}>
      {showIcon && (
        <span className={cn('self-center', colorClass)}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4 inline" />
          ) : isNegative ? (
            <TrendingDown className="w-4 h-4 inline" />
          ) : (
            <Minus className="w-4 h-4 inline" />
          )}
        </span>
      )}
      <span className={cn(sizeClasses, colorClass)}>
        {formatINR(value, { showSign, compact })}
      </span>
      {percentage !== null && percentage !== undefined && (
        <span
          className={cn(
            'text-xs font-mono font-medium opacity-85',
            colorClass
          )}
        >
          ({isPositive ? '+' : ''}
          {formatPercent(percentage)})
        </span>
      )}
    </div>
  );
}
