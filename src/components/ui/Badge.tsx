import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'intraday'
  | 'delivery'
  | 'long'
  | 'short'
  | 'open'
  | 'closed'
  | 'kite'
  | 'shoonya'
  | 'admin'
  | 'viewer'
  | 'positive'
  | 'negative'
  | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]',
  intraday:
    'bg-blue-500/10 text-blue-500 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400',
  delivery:
    'bg-purple-500/10 text-purple-600 border border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-300',
  long:
    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400',
  short:
    'bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400',
  open:
    'bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400',
  closed:
    'bg-slate-500/10 text-slate-600 border border-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400',
  kite:
    'bg-orange-500/10 text-orange-600 border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400',
  shoonya:
    'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400',
  admin:
    'bg-violet-500/10 text-violet-600 border border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-300 font-semibold',
  viewer:
    'bg-sky-500/10 text-sky-600 border border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-300',
  positive:
    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400',
  negative:
    'bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400',
  neutral:
    'bg-slate-500/10 text-slate-500 border border-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide uppercase font-mono transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
