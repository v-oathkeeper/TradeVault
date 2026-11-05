import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an amount in INR currency (₹)
 * Example: 125430.5 -> "₹1,25,430.50"
 */
export function formatINR(
  amount: number | string | null | undefined,
  options?: {
    showSign?: boolean;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
    compact?: boolean;
  }
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₹0.00';
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    notation: options?.compact ? 'compact' : 'standard',
  });

  const formatted = formatter.format(absNum);

  if (options?.showSign) {
    if (num > 0) return `+${formatted}`;
    if (num < 0) return `-${formatted}`;
    return formatted;
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format a number as percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date in Indian context (DD MMM YYYY or DD/MM/YYYY HH:mm)
 */
export function formatDate(
  dateStr: string | Date | null | undefined,
  options?: { includeTime?: boolean }
): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(d.getTime())) return '—';

  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(options?.includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
  });
}
