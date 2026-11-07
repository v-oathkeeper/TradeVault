'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  Plus,
  TrendingUp,
  Menu,
  X,
  BarChart3,
  Users,
  Download,
  Settings,
  LogOut,
  Sun,
  Moon,
  UploadCloud,
  FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/components/providers/UserContext';
import { useTheme } from 'next-themes';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ImportTradeModal } from '@/components/trades/ImportTradeModal';
import { toast } from 'sonner';

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, role, fullName, email } = useUser();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const navTabs = [
    {
      title: 'Home',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Trades',
      href: '/trades',
      icon: History,
    },
    ...(isAdmin
      ? [
          {
            title: 'Add',
            href: '/trades/new',
            icon: Plus,
            isPrimary: true,
          },
        ]
      : []),
    {
      title: 'Positions',
      href: '/positions',
      icon: TrendingUp,
    },
  ];

  return (
    <>
      {/* Bottom navigation bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)]/90 backdrop-blur-md border-t border-[var(--border)] pb-safe shadow-lg">
        <div className="flex items-center justify-around h-16 px-2">
          {navTabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== '/dashboard' && pathname.startsWith(tab.href));

            if (tab.isPrimary) {
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="flex flex-col items-center justify-center -mt-5"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-95 transition-transform">
                    <Plus className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[10px] font-medium text-[var(--muted)] mt-1">
                    Add
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 py-1 transition-colors',
                  isActive
                    ? 'text-blue-500 font-semibold'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                )}
              >
                <tab.icon className={cn('w-5 h-5', isActive && 'stroke-[2.5]')} />
                <span className="text-[10px] tracking-tight mt-1">
                  {tab.title}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-1">More</span>
          </button>
        </div>
      </nav>

      {/* More menu drawer */}
      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[var(--card)] border-t border-[var(--border)] rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <div>
                <h3 className="font-semibold text-base text-[var(--foreground)]">
                  {fullName || 'Account'}
                </h3>
                <p className="text-xs text-[var(--muted)] font-mono">{email}</p>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-2 rounded-full hover:bg-[var(--background)] text-[var(--muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/analytics"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium"
              >
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span>Analytics</span>
              </Link>
              <Link
                href="/people"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium"
              >
                <Users className="w-4 h-4 text-purple-500" />
                <span>People</span>
              </Link>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowImportModal(true);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium text-left"
                  >
                    <UploadCloud className="w-4 h-4 text-blue-500" />
                    <span>Import Trade</span>
                  </button>
                  <Link
                    href="/reports/weekly"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium"
                  >
                    <FileBarChart className="w-4 h-4 text-indigo-500" />
                    <span>Weekly Reports</span>
                  </Link>
                  <Link
                    href="/exports"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium"
                  >
                    <Download className="w-4 h-4 text-emerald-500" />
                    <span>Exports</span>
                  </Link>
                </>
              )}
              <Link
                href="/settings"
                onClick={() => setShowMoreMenu(false)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] text-sm font-medium"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                <span>Settings</span>
              </Link>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setTheme((resolvedTheme || theme) === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-medium"
              >
                {mounted ? (
                  (resolvedTheme || theme) === 'dark' ? (
                    <>
                      <Sun className="w-4 h-4 text-amber-500" />
                      Light Theme
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4 text-blue-500" />
                      Dark Theme
                    </>
                  )
                ) : (
                  <div className="w-4 h-4" />
                )}
              </button>

              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 text-rose-500 text-xs font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Trade Modal */}
      <ImportTradeModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
