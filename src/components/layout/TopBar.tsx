'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Users, Filter } from 'lucide-react';
import { useUser } from '@/components/providers/UserContext';
import { cn } from '@/lib/utils';

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const {
    persons,
    selectedPersonId,
    setSelectedPersonId,
    getPersonLabel,
    dateRange,
    setDateRange,
  } = useUser();

  const dateRangeOptions: { id: 'all' | '1m' | '3m' | '6m' | '1y' | 'ytd'; label: string }[] = [
    { id: 'all', label: 'All Time' },
    { id: '1m', label: '1M' },
    { id: '3m', label: '3M' },
    { id: '6m', label: '6M' },
    { id: '1y', label: '1Y' },
    { id: 'ytd', label: 'YTD' },
  ];

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {title && (
          <h1 className="text-lg font-bold tracking-tight text-[var(--foreground)] hidden sm:block">
            {title}
          </h1>
        )}

        {/* Dynamic Person Selector Segmented Control */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium">
          <button
            type="button"
            onClick={() => setSelectedPersonId('combined')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-all',
              selectedPersonId === 'combined'
                ? 'bg-[var(--card)] text-blue-500 font-semibold shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            )}
          >
            Combined
          </button>
          {persons.map((person) => {
            const isSelected = selectedPersonId === person.id;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => setSelectedPersonId(person.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  isSelected
                    ? 'bg-[var(--card)] text-blue-500 font-semibold shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                )}
              >
                {getPersonLabel(person.id)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date range filter on larger screens */}
        <div className="hidden md:flex items-center p-1 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium">
          {dateRangeOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDateRange(opt.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all',
                dateRange === opt.id
                  ? 'bg-[var(--card)] text-[var(--foreground)] font-semibold shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => setTheme((resolvedTheme || theme) === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {mounted ? (
            (resolvedTheme || theme) === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-blue-500" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
