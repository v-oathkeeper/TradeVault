'use client';

import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  History,
  Trash2,
  Edit2,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { TradeCard } from '@/components/trades/TradeCard';
import { Badge } from '@/components/ui/Badge';
import { PnlDisplay } from '@/components/ui/PnlDisplay';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useUser } from '@/components/providers/UserContext';
import { formatDate, formatINR, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Trade, TradeType, TradeStatus } from '@/types/app';

const ImportTradeModal = dynamic(
  () => import('@/components/trades/ImportTradeModal').then((mod) => mod.ImportTradeModal),
  { ssr: false }
);

interface TradeHistoryClientProps {
  initialTrades: Trade[];
}

export function TradeHistoryClient({ initialTrades }: TradeHistoryClientProps) {
  const router = useRouter();
  const { persons, getPersonLabel, isAdmin } = useUser();

  const [trades, setTrades] = useState<Trade[]>(initialTrades);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  const [selectedPerson, setSelectedPerson] = useState<string>('all');
  const [selectedBroker, setSelectedBroker] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('all');

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Pagination state
  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to first page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, selectedPerson, selectedBroker, selectedType, selectedStatus, selectedOutcome]);

  // Filtered and sorted trades using deferred search for non-blocking typing
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      // Search
      if (
        deferredSearch &&
        !trade.symbol.toLowerCase().includes(deferredSearch.toLowerCase())
      ) {
        return false;
      }
      // Person
      if (selectedPerson !== 'all' && trade.portfolioOwnerId !== selectedPerson) {
        return false;
      }
      // Broker
      if (selectedBroker !== 'all' && trade.broker?.code !== selectedBroker) {
        return false;
      }
      // Type
      if (selectedType !== 'all' && trade.tradeType !== selectedType) {
        return false;
      }
      // Status
      if (selectedStatus !== 'all' && trade.status !== selectedStatus) {
        return false;
      }
      // Outcome (Profit vs Loss)
      if (selectedOutcome === 'profit' && (trade.netPnl ?? 0) <= 0) {
        return false;
      }
      if (selectedOutcome === 'loss' && (trade.netPnl ?? 0) >= 0) {
        return false;
      }
      return true;
    });
  }, [
    trades,
    deferredSearch,
    selectedPerson,
    selectedBroker,
    selectedType,
    selectedStatus,
    selectedOutcome,
  ]);

  const totalPages = Math.ceil(filteredTrades.length / PAGE_SIZE) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTrades.slice(start, start + PAGE_SIZE);
  }, [filteredTrades, currentPage]);

  const handleDeleteTrade = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/trades/${deleteTargetId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to delete trade');
      }

      setTrades((prev) => prev.filter((t) => t.id !== deleteTargetId));
      toast.success('Trade deleted successfully');
    } catch (err: any) {
      toast.error('Could not delete trade', { description: err.message });
    } finally {
      setIsDeleting(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Trade Journal
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Comprehensive audit log of all household trades, fills, and broker charges
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--card)] hover:bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] font-semibold text-xs transition-colors shadow-sm"
            >
              <UploadCloud className="w-4 h-4 text-blue-500" />
              <span>Import Trade</span>
            </button>
            <Link
              href="/trades/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Trade</span>
            </Link>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search Input */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol (e.g. INFY)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono uppercase focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Person Filter */}
          <select
            value={selectedPerson}
            onChange={(e) => setSelectedPerson(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
          >
            <option value="all">All Portfolios</option>
            {persons.map((p) => (
              <option key={p.id} value={p.id}>
                {getPersonLabel(p.id)}
              </option>
            ))}
          </select>

          {/* Broker Filter */}
          <select
            value={selectedBroker}
            onChange={(e) => setSelectedBroker(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
          >
            <option value="all">All Brokers</option>
            <option value="KITE">Zerodha Kite</option>
            <option value="SHOONYA">Shoonya</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
          >
            <option value="all">All Products</option>
            <option value="INTRADAY">Intraday</option>
            <option value="DELIVERY">Delivery</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="CLOSED">Closed Trades</option>
            <option value="OPEN">Open Positions</option>
          </select>
        </div>
      </div>

      {/* Trades List (Desktop Table + Mobile Cards) */}
      {filteredTrades.length === 0 ? (
        <EmptyState
          icon={History}
          title="No trades match filters"
          description="Try clearing search filters or record a new trade."
          actionHref={isAdmin ? '/trades/new' : undefined}
          actionLabel={isAdmin ? 'Record Trade' : undefined}
        />
      ) : (
        <>
          {/* Mobile view (< lg) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
            {paginatedTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                onDelete={(id) => setDeleteTargetId(id)}
              />
            ))}
          </div>

          {/* Desktop view (lg+) */}
          <div className="hidden lg:block overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--background)]/60 text-[var(--muted)] uppercase font-semibold tracking-wider font-mono">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Symbol</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Broker</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Dir</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Entry (₹)</th>
                  <th className="py-3 px-4 text-right">Exit (₹)</th>
                  <th className="py-3 px-4 text-right">Gross P&L</th>
                  <th className="py-3 px-4 text-right">Charges</th>
                  <th className="py-3 px-4 text-right">Net P&L</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginatedTrades.map((trade) => {
                  const personLabel = getPersonLabel(trade.portfolioOwnerId);
                  const brokerCode = trade.broker?.code ?? 'KITE';

                  return (
                    <tr
                      key={trade.id}
                      className="hover:bg-[var(--background)]/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-[var(--muted)] whitespace-nowrap">
                        {formatDate(trade.entryAt)}
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-[var(--foreground)]">
                        {trade.symbol}
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--foreground)]">
                        {personLabel}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={brokerCode.toLowerCase() as 'kite' | 'shoonya'}>
                          {brokerCode}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={trade.tradeType === 'INTRADAY' ? 'intraday' : 'delivery'}
                        >
                          {trade.tradeType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'font-bold font-mono',
                            trade.direction === 'LONG'
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          )}
                        >
                          {trade.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        {trade.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatINR(trade.entryPrice)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {trade.exitPrice ? formatINR(trade.exitPrice) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {trade.grossPnl !== null ? (
                          <span
                            className={
                              trade.grossPnl >= 0
                                ? 'text-emerald-500'
                                : 'text-rose-500'
                            }
                          >
                            {formatINR(trade.grossPnl, { showSign: true })}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-amber-500">
                        {formatINR(trade.totalCharges)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {trade.netPnl !== null ? (
                          <PnlDisplay value={trade.netPnl} size="sm" />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={trade.status === 'OPEN' ? 'open' : 'closed'}>
                          {trade.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/trades/${trade.id}`}
                            className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-blue-500 transition-colors"
                            title="View Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          {isAdmin && (
                            <>
                              <Link
                                href={`/trades/${trade.id}/edit`}
                                className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-amber-500 transition-colors"
                                title="Edit Trade"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleteTargetId(trade.id)}
                                className="p-1.5 rounded-lg hover:bg-[var(--background)] text-[var(--muted)] hover:text-rose-500 transition-colors"
                                title="Delete Trade"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Client-side Pagination Controls */}
          {filteredTrades.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--muted)]">
              <div>
                Showing <span className="font-semibold text-[var(--foreground)]">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
                <span className="font-semibold text-[var(--foreground)]">
                  {Math.min(currentPage * PAGE_SIZE, filteredTrades.length)}
                </span>{' '}
                of <span className="font-semibold text-[var(--foreground)]">{filteredTrades.length}</span> trades
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--card)] transition-colors font-medium text-[var(--foreground)]"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-mono text-[var(--foreground)]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--card)] transition-colors font-medium text-[var(--foreground)]"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Trade"
        description="Are you sure you want to permanently delete this trade record? This will recalculate cumulative equity curve and monthly P&L figures."
        confirmLabel="Delete Trade"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleDeleteTrade}
      />

      {/* Import Trade Dialog */}
      <ImportTradeModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
