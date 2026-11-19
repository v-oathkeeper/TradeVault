import React from 'react';
import Link from 'next/link';
import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LottieAnimation } from '@/components/ui/LottieAnimation';
import { emptyVaultAnimation } from '@/lib/animations/lottie-data';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  useLottie?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionHref,
  actionLabel,
  onAction,
  className,
  useLottie = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl bg-[var(--card)] border border-dashed border-[var(--border)] card-hover animate-fade-in',
        className
      )}
    >
      {useLottie ? (
        <div className="mb-2">
          <LottieAnimation animationData={emptyVaultAnimation} className="w-24 h-24 mx-auto" />
        </div>
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-4 animate-float">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold text-[var(--foreground)] mb-1">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-[var(--muted)] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
