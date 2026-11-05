'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Settings,
  Sun,
  Moon,
  Laptop,
  Globe,
  IndianRupee,
  Shield,
  Building2,
  ChevronRight,
  Database,
  Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/components/providers/UserContext';

export function SettingsClient() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const { email, fullName, role, isAdmin, householdId } = useUser();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Application Settings
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Household profile, security preferences, and broker tariff configurations
        </p>
      </div>

      <div className="space-y-4">
        {/* Account Profile Card */}
        <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-base font-mono">
              {email.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[var(--foreground)]">
                  {fullName || email.split('@')[0]}
                </h3>
                <Badge variant={isAdmin ? 'admin' : 'viewer'}>{role}</Badge>
              </div>
              <p className="text-xs text-[var(--muted)] font-mono">{email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[var(--border)] text-xs">
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
              <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">
                Authorization Role
              </span>
              <p className="font-medium text-[var(--foreground)]">
                {isAdmin
                  ? 'Admin (Full Management & Trade Recording)'
                  : 'Viewer (Read-Only Access)'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
              <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">
                Household Identity
              </span>
              <p className="font-mono text-[11px] text-[var(--muted)] truncate">
                {householdId}
              </p>
            </div>
          </div>
        </div>

        {/* Display & Localization Preferences */}
        <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <h3 className="font-bold text-base text-[var(--foreground)]">
            Appearance & Locale
          </h3>

          <div className="space-y-4">
            {/* Theme switcher */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-[var(--foreground)] block">
                  Interface Theme
                </span>
                <span className="text-xs text-[var(--muted)]">
                  Customize visual mode
                </span>
              </div>

              <div className="flex items-center p-1 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium" suppressHydrationWarning>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    mounted && (resolvedTheme || theme) === 'light'
                      ? 'bg-[var(--card)] text-amber-500 font-semibold shadow-sm'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    mounted && (resolvedTheme || theme) === 'dark'
                      ? 'bg-[var(--card)] text-blue-500 font-semibold shadow-sm'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                    mounted && theme === 'system'
                      ? 'bg-[var(--card)] text-[var(--foreground)] font-semibold shadow-sm'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  <Laptop className="w-3.5 h-3.5" />
                  System
                </button>
              </div>
            </div>

            {/* Currency */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <div>
                <span className="text-sm font-semibold text-[var(--foreground)] block">
                  Base Currency
                </span>
                <span className="text-xs text-[var(--muted)]">
                  All accounting values are computed in Indian Rupees
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-semibold px-3 py-1.5 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                <IndianRupee className="w-4 h-4 text-blue-500" />
                <span>INR (₹)</span>
              </div>
            </div>

            {/* Timezone */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <div>
                <span className="text-sm font-semibold text-[var(--foreground)] block">
                  Timezone
                </span>
                <span className="text-xs text-[var(--muted)]">
                  NSE/BSE Indian Standard Time
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span>Asia/Kolkata (IST)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Broker Tariff Engine Link */}
        <Link
          href="/settings/brokers"
          className="flex items-center justify-between p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm hover:border-blue-500/50 transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)] group-hover:text-blue-500 transition-colors">
                Broker Tariff & Fee Schedules
              </h3>
              <p className="text-xs text-[var(--muted)]">
                Inspect official fee rules for Zerodha Kite and Shoonya
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--muted)] group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
