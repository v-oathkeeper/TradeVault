'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  TrendingUp,
  BarChart3,
  Users,
  Download,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  UploadCloud,
  FileBarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useUser } from '@/components/providers/UserContext';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

const ImportTradeModal = dynamic(
  () => import('@/components/trades/ImportTradeModal').then((m) => m.ImportTradeModal),
  { ssr: false }
);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { fullName, email, role, isAdmin } = useUser();
  const [showImportModal, setShowImportModal] = useState(false);
  const supabase = createSupabaseBrowserClient();

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

  const navItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'All Trades',
      href: '/trades',
      icon: History,
    },
    {
      title: 'Open Positions',
      href: '/positions',
      icon: TrendingUp,
    },
    {
      title: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
    },
    {
      title: 'Weekly Reports',
      href: '/reports/weekly',
      icon: FileBarChart,
      adminOnly: true,
    },
    {
      title: 'People',
      href: '/people',
      icon: Users,
    },
    {
      title: 'Exports',
      href: '/exports',
      icon: Download,
      adminOnly: true,
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-[var(--border)] bg-[var(--card)] h-screen sticky top-0 z-30 select-none">
      {/* Brand header */}
      <div className="h-16 flex items-center px-6 border-b border-[var(--border)] gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
            TradeVault
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-medium">
            Family Analytics
          </span>
        </div>
      </div>

      {/* Primary Action Button (Admin Only) */}
      {isAdmin && (
        <div className="px-4 pt-4 pb-2 space-y-2">
          <Link
            href="/trades/new"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm shadow-sm transition-all active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Trade</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[var(--background)] hover:bg-blue-500/10 border border-[var(--border)] hover:border-blue-500/30 text-[var(--foreground)] font-semibold text-xs shadow-sm transition-all active:scale-[0.98]"
          >
            <UploadCloud className="w-4 h-4 text-blue-500" />
            <span>Import Trade</span>
          </button>
        </div>
      )}

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;

          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors relative group',
                isActive
                  ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]'
              )}
            >
              <item.icon
                className={cn(
                  'w-4 h-4 transition-colors',
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'
                )}
              />
              <span className="flex-1">{item.title}</span>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase font-mono">
            {fullName ? fullName.slice(0, 2) : email.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--foreground)] truncate">
                {fullName || email.split('@')[0]}
              </span>
              <Badge variant={isAdmin ? 'admin' : 'viewer'} className="text-[9px] px-1.5 py-0">
                {role}
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--muted)] truncate font-mono">
              {email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="p-1.5 text-[var(--muted)] hover:text-rose-500 rounded-lg hover:bg-[var(--card)] transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Import Trade Dialog */}
      <ImportTradeModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </aside>
  );
}
