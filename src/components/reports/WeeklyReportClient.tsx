'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileBarChart,
  Download,
  Copy,
  Check,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileJson,
  Zap,
  Info,
  Clock,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getWeeklyPresetsIST } from '@/lib/calculations/weekly-calendar';
import type { WeeklyTradingReportJSON, ReportTradeItem } from '@/types/weekly-report';

interface PersonOption {
  id: string;
  label: string;
}

interface BrokerOption {
  code: 'ALL' | 'ZERODHA' | 'SHOONYA';
  name: string;
}

interface WeeklyReportClientProps {
  isAdmin: boolean;
  userRole: string;
  persons: PersonOption[];
  brokers: BrokerOption[];
}

export function WeeklyReportClient({
  isAdmin,
  userRole,
  persons,
}: WeeklyReportClientProps) {
  const presets = useMemo(() => getWeeklyPresetsIST(), []);

  // Filter state
  const [selectedPreset, setSelectedPreset] = useState<string>(presets[0]?.id || 'completed_week');
  const [startDate, setStartDate] = useState<string>(presets[0]?.startDate || '');
  const [endDate, setEndDate] = useState<string>(presets[0]?.endDate || '');
  const [portfolioOwner, setPortfolioOwner] = useState<string>('all');
  const [strategy, setStrategy] = useState<'BOTH' | 'INTRADAY' | 'SWING'>('BOTH');
  const [broker, setBroker] = useState<'ALL' | 'ZERODHA' | 'SHOONYA'>('ALL');

  // Report state
  const [report, setReport] = useState<WeeklyTradingReportJSON | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'intraday' | 'swing' | 'trades' | 'ai' | 'json'>('summary');

  // Handle Preset change
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      setStartDate(found.startDate);
      setEndDate(found.endDate);
    }
  };

  // Generate Report function
  const handleGenerateReport = async () => {
    if (!isAdmin) {
      toast.error('Only ADMIN users can generate weekly reports.');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please specify valid start and end dates.');
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        portfolioOwner,
        strategy,
        broker,
      });

      const res = await fetch(`/api/reports/weekly?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server returned error (${res.status})`);
      }

      const reportData: WeeklyTradingReportJSON = await res.json();
      setReport(reportData);
      toast.success('Weekly report compiled successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically fetch default completed week on first mount if admin
  useEffect(() => {
    if (isAdmin && presets[0]) {
      handleGenerateReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Export JSON file download
  const handleExportJson = () => {
    if (!report) {
      toast.error('Please generate a report first before exporting.');
      return;
    }

    try {
      const jsonString = JSON.stringify(report, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tradevault-weekly-report-${report.period.start_date}-to-${report.period.end_date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('JSON report downloaded successfully');
    } catch {
      toast.error('Failed to export JSON report');
    }
  };

  // Copy JSON to clipboard
  const handleCopyJson = async () => {
    if (!report) {
      toast.error('Please generate a report first before copying.');
      return;
    }

    try {
      const jsonString = JSON.stringify(report, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      toast.success('Full JSON report copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Copy AI Prompt context
  const handleCopyAiPrompt = async () => {
    if (!report) return;

    try {
      const aiPrompt = `Here is the TradeVault Weekly Trading Performance Report (v${report.report_version}) for the period ${report.period.start_date} to ${report.period.end_date} (IST):

Summary Metrics:
- Total Trades: ${report.summary.total_trades}
- Win Rate: ${report.summary.win_rate !== null ? report.summary.win_rate.toFixed(1) + '%' : 'N/A'} (${report.summary.winning_trades}W / ${report.summary.losing_trades}L / ${report.summary.breakeven_trades}BE)
- Gross Realized P&L: ₹${report.summary.gross_realized_pnl.toFixed(2)}
- Total Broker & Statutory Charges: ₹${report.summary.total_charges.toFixed(2)}
- Net Realized P&L: ₹${report.summary.net_realized_pnl.toFixed(2)}
- Profit Factor: ${report.summary.profit_factor !== null ? report.summary.profit_factor.toFixed(2) : 'N/A'}
- Realized R-Multiple: ${report.summary.average_realized_r_multiple !== null ? report.summary.average_realized_r_multiple.toFixed(2) + 'R' : 'N/A'}
- Expectancy: ₹${report.summary.expectancy !== null ? report.summary.expectancy.toFixed(2) : 'N/A'} per trade

AI Review Focus:
- Negative R Trades: ${report.ai_review.trades_with_negative_r.length}
- Risk Increased After Entry: ${report.ai_review.trades_where_risk_increased.length}
- Missing Rationale: ${report.ai_review.missing_rationales.length} trades
- Repeated Symbols: ${report.ai_review.repeated_symbols.map((s) => `${s.symbol} (${s.count}x)`).join(', ') || 'None'}

Please perform a thorough review of my execution discipline, risk management, stop-loss adherence, and identify actionable improvements for next week.

Full JSON Payload:
${JSON.stringify(report, null, 2)}`;

      await navigator.clipboard.writeText(aiPrompt);
      setCopiedAi(true);
      toast.success('AI Prompt with context copied to clipboard');
      setTimeout(() => setCopiedAi(false), 2000);
    } catch {
      toast.error('Failed to copy AI prompt');
    }
  };

  // Unauthorized Viewer view
  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-start gap-4">
          <ShieldAlert className="w-8 h-8 shrink-0 text-amber-500 mt-1" />
          <div>
            <h2 className="text-lg font-bold text-amber-500">Access Restricted</h2>
            <p className="text-sm mt-1 text-[var(--muted)]">
              Weekly trading reports and JSON exports are reserved for ADMIN users. Your current account role is{' '}
              <span className="font-semibold text-amber-400 uppercase">{userRole}</span>. Please log in with an administrator account to access performance analytics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <FileBarChart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                Weekly Trading Reports
              </h1>
              <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                Generate and export standardized JSON performance reports for Intraday (MIS), Swing (CNC), and Combined trading
              </p>
            </div>
          </div>
        </div>

        {/* Global Export & Copy Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyJson}
            disabled={!report || isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--border)]/30 text-xs font-semibold text-[var(--foreground)] shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-[var(--muted)]" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={!report || isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Week Preset */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Trading Week</span>
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
              Start Date (IST)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset('custom');
              }}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
              End Date (IST)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset('custom');
              }}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Portfolio Owner Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span>Portfolio Owner</span>
            </label>
            <select
              value={portfolioOwner}
              onChange={(e) => setPortfolioOwner(e.target.value)}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">Combined (All)</option>
              <option value="me">Me (Husband)</option>
              <option value="spouse">Spouse (Wife)</option>
              {persons
                .filter((p) => p.id !== 'all' && p.id !== 'me' && p.id !== 'spouse')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
            </select>
          </div>

          {/* Strategy Filter */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-500" />
              <span>Strategy</span>
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as any)}
              className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="BOTH">Combined (Intraday + Swing)</option>
              <option value="INTRADAY">Intraday (MIS)</option>
              <option value="SWING">Swing (CNC)</option>
            </select>
          </div>
        </div>

        {/* Second Row: Broker & Generate Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border)]/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[var(--muted)]" />
              <span className="text-xs text-[var(--muted)] font-medium">Broker:</span>
            </div>
            <div className="flex items-center gap-1.5">
              {(['ALL', 'ZERODHA', 'SHOONYA'] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBroker(b)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    broker === b
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-[var(--background)] text-[var(--muted)] hover:text-[var(--foreground)] border border-[var(--border)]'
                  }`}
                >
                  {b === 'ALL' ? 'All' : b === 'ZERODHA' ? 'Zerodha' : 'Shoonya'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Compiling Report...' : 'Generate Report'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-16 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Compiling weekly trading report...
          </p>
          <p className="text-xs text-[var(--muted)]">
            Analyzing executions, fee breakdowns, R-multiples, and stop-loss decisions
          </p>
        </div>
      ) : !report ? (
        <div className="p-16 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex flex-col items-center justify-center text-center space-y-3">
          <FileBarChart className="w-12 h-12 text-[var(--muted)]" />
          <p className="text-base font-semibold text-[var(--foreground)]">No report loaded</p>
          <p className="text-xs text-[var(--muted)] max-w-sm">
            Select a trading week and filters above, then click &quot;Generate Report&quot; to compile your comprehensive trading analytics.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key KPI Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Net Realized P&L */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
              <div className="flex items-center justify-between text-[var(--muted)] mb-1">
                <span className="text-[11px] font-medium">Net Realized P&L</span>
                {report.summary.net_realized_pnl >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                )}
              </div>
              <div
                className={`text-lg sm:text-xl font-bold tracking-tight ${
                  report.summary.net_realized_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {report.summary.net_realized_pnl >= 0 ? '+' : ''}₹
                {report.summary.net_realized_pnl.toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1 truncate">
                Gross: ₹{report.summary.gross_realized_pnl.toFixed(2)}
              </div>
            </div>

            {/* Total Charges */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
              <div className="text-[11px] font-medium text-[var(--muted)] mb-1">
                Total Charges
              </div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-[var(--foreground)]">
                ₹{report.summary.total_charges.toFixed(2)}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1 truncate">
                Brokerage & statutory
              </div>
            </div>

            {/* Win Rate */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
              <div className="text-[11px] font-medium text-[var(--muted)] mb-1">
                Win Rate
              </div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-[var(--foreground)]">
                {report.summary.win_rate !== null
                  ? `${report.summary.win_rate.toFixed(1)}%`
                  : 'N/A'}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1 truncate">
                {report.summary.winning_trades}W / {report.summary.losing_trades}L / {report.summary.breakeven_trades}BE
              </div>
            </div>

            {/* Profit Factor */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
              <div className="text-[11px] font-medium text-[var(--muted)] mb-1">
                Profit Factor
              </div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-[var(--foreground)]">
                {report.summary.profit_factor !== null
                  ? report.summary.profit_factor.toFixed(2)
                  : 'N/A'}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1 truncate">
                Exp: {report.summary.expectancy !== null ? `₹${report.summary.expectancy.toFixed(0)}/tr` : 'N/A'}
              </div>
            </div>

            {/* Realized R-Multiple */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
              <div className="text-[11px] font-medium text-[var(--muted)] mb-1">
                Avg Realized R
              </div>
              <div
                className={`text-lg sm:text-xl font-bold tracking-tight ${
                  (report.summary.average_realized_r_multiple ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {report.summary.average_realized_r_multiple !== null
                  ? `${report.summary.average_realized_r_multiple >= 0 ? '+' : ''}${report.summary.average_realized_r_multiple.toFixed(2)}R`
                  : 'N/A'}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1 truncate">
                Risk: ₹{report.summary.total_initial_risk.toFixed(0)}
              </div>
            </div>

            {/* Open Risk & Protected Profit */}
            <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
              <div className="text-[11px] font-medium text-[var(--muted)] mb-1">
                Open Risk / Protected
              </div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-[var(--foreground)]">
                ₹{report.portfolio_risk.current_open_risk_rupees.toFixed(0)}
              </div>
              <div className="text-[10px] text-emerald-500 font-medium mt-1 truncate">
                Protected: +₹{report.portfolio_risk.estimated_stop_protected_profit.toFixed(0)}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto pb-1 text-xs">
            {[
              { id: 'summary', label: 'Summary Overview', icon: FileBarChart },
              { id: 'intraday', label: `Intraday MIS (${report.intraday.summary.total_trades})`, icon: Zap },
              { id: 'swing', label: `Swing CNC (${report.swing.summary.total_trades})`, icon: Target },
              { id: 'trades', label: `Trade Ledger (${report.trades.length})`, icon: Clock },
              { id: 'ai', label: 'AI Review Insights', icon: AlertCircle },
              { id: 'json', label: 'JSON Schema v1.0', icon: FileJson },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: SUMMARY OVERVIEW */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Statistics Table */}
              <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span>Key Performance Statistics</span>
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Total Trades</span>
                    <span className="font-semibold text-[var(--foreground)]">{report.summary.total_trades}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Trading Days</span>
                    <span className="font-semibold text-[var(--foreground)]">{report.summary.trading_days}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Trades / Day</span>
                    <span className="font-semibold text-[var(--foreground)]">
                      {report.summary.trades_per_day !== null ? report.summary.trades_per_day.toFixed(1) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Avg Profit / Trade</span>
                    <span className="font-semibold text-emerald-500">
                      {report.summary.average_profit_per_trade !== null ? `₹${report.summary.average_profit_per_trade.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Avg Loss / Trade</span>
                    <span className="font-semibold text-rose-500">
                      {report.summary.average_loss_per_trade !== null ? `₹${report.summary.average_loss_per_trade.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Largest Winner</span>
                    <span className="font-semibold text-emerald-500">
                      {report.summary.largest_winner !== null ? `${report.summary.largest_winner.symbol} (+₹${report.summary.largest_winner.net_pnl.toFixed(0)})` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Largest Loser</span>
                    <span className="font-semibold text-rose-500">
                      {report.summary.largest_loser !== null ? `${report.summary.largest_loser.symbol} (₹${report.summary.largest_loser.net_pnl.toFixed(0)})` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Avg Winning R</span>
                    <span className="font-semibold text-emerald-500">
                      {report.summary.average_winning_r !== null ? `+${report.summary.average_winning_r.toFixed(2)}R` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Avg Losing R</span>
                    <span className="font-semibold text-rose-500">
                      {report.summary.average_losing_r !== null ? `${report.summary.average_losing_r.toFixed(2)}R` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Max Consecutive Wins</span>
                    <span className="font-semibold text-[var(--foreground)]">{report.summary.max_consecutive_wins}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Max Consecutive Losses</span>
                    <span className="font-semibold text-[var(--foreground)]">{report.summary.max_consecutive_losses}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border)]/40">
                    <span className="text-[var(--muted)]">Avg Holding Time</span>
                    <span className="font-semibold text-[var(--foreground)]">{report.summary.average_holding_period || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Weekly Inclusion Policy & Activity Breakdown */}
              <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-500" />
                  <span>Weekly Period Activity Breakdown</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]/60">
                    <span className="text-[var(--foreground)] font-medium">New Trades Opened This Week</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold">
                      {report.weekly_activity.new_trades_opened_this_week}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]/60">
                    <span className="text-[var(--foreground)] font-medium">Trades Fully Closed This Week</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold">
                      {report.weekly_activity.trades_closed_this_week}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]/60">
                    <span className="text-[var(--foreground)] font-medium">Partial Exits Executed This Week</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-bold">
                      {report.weekly_activity.partial_exits_this_week}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]/60">
                    <span className="text-[var(--foreground)] font-medium">Open Positions Carried Forward</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">
                      {report.weekly_activity.open_positions_carried_forward}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)]/60">
                    <span className="text-[var(--foreground)] font-medium">Stop-Loss Management Updates</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 font-bold">
                      {report.weekly_activity.stop_loss_updates_this_week}
                    </span>
                  </div>
                </div>
              </div>

              {/* Long vs Short Performance */}
              <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-[var(--foreground)]">Directional Performance</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-500 flex items-center gap-1">
                        <ArrowUpRight className="w-4 h-4" /> LONG
                      </span>
                      <span className="text-[var(--muted)]">{report.summary.long_vs_short.long.trades} trades</span>
                    </div>
                    <div className="text-sm font-bold text-[var(--foreground)]">
                      ₹{report.summary.long_vs_short.long.net_pnl.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">
                      Win Rate:{' '}
                      {report.summary.long_vs_short.long.win_rate !== null
                        ? `${report.summary.long_vs_short.long.win_rate.toFixed(1)}%`
                        : 'N/A'}{' '}
                      ({report.summary.long_vs_short.long.wins}W / {report.summary.long_vs_short.long.losses}L)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-500 flex items-center gap-1">
                        <ArrowDownRight className="w-4 h-4" /> SHORT
                      </span>
                      <span className="text-[var(--muted)]">{report.summary.long_vs_short.short.trades} trades</span>
                    </div>
                    <div className="text-sm font-bold text-[var(--foreground)]">
                      ₹{report.summary.long_vs_short.short.net_pnl.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">
                      Win Rate:{' '}
                      {report.summary.long_vs_short.short.win_rate !== null
                        ? `${report.summary.long_vs_short.short.win_rate.toFixed(1)}%`
                        : 'N/A'}{' '}
                      ({report.summary.long_vs_short.short.wins}W / {report.summary.long_vs_short.short.losses}L)
                    </div>
                  </div>
                </div>
              </div>

              {/* Broker-Wise Performance */}
              <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-[var(--foreground)]">Broker-Wise Performance</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {report.summary.broker_performance.map((b) => (
                    <div key={b.broker_code} className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-500">{b.broker_name}</span>
                        <span className="text-[var(--muted)]">{b.trades} trades</span>
                      </div>
                      <div className="text-sm font-bold text-[var(--foreground)]">
                        ₹{b.net_pnl.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">
                        Charges: ₹{b.total_charges.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTRADAY MIS */}
          {activeTab === 'intraday' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Intraday Trades</div>
                  <div className="text-xl font-bold text-[var(--foreground)]">{report.intraday.summary.total_trades}</div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    {report.intraday.summary.winning_trades}W / {report.intraday.summary.losing_trades}L / {report.intraday.summary.breakeven_trades}BE
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Intraday Net P&L</div>
                  <div
                    className={`text-xl font-bold ${
                      report.intraday.summary.net_realized_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    ₹{report.intraday.summary.net_realized_pnl.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    Charges: ₹{report.intraday.summary.total_charges.toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Avg Realized R</div>
                  <div className="text-xl font-bold text-[var(--foreground)]">
                    {report.intraday.summary.average_realized_r_multiple !== null ? `${report.intraday.summary.average_realized_r_multiple.toFixed(2)}R` : 'N/A'}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    Profit Factor: {report.intraday.summary.profit_factor !== null ? report.intraday.summary.profit_factor.toFixed(2) : 'N/A'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Avg Holding Time</div>
                  <div className="text-xl font-bold text-[var(--foreground)]">
                    {report.intraday.summary.average_holding_minutes !== null ? `${report.intraday.summary.average_holding_minutes} mins` : 'N/A'}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    {report.intraday.summary.trades_per_day !== null ? `${report.intraday.summary.trades_per_day.toFixed(1)} trades/day` : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Time of Day Performance */}
              <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span>Time-of-Day Execution Performance (IST)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {report.intraday.summary.time_of_day_performance.map((tod) => (
                    <div key={tod.period} className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2">
                      <div className="flex items-center justify-between font-bold text-[var(--foreground)]">
                        <span>{tod.label}</span>
                        <span className="text-[var(--muted)]">{tod.trades} trades</span>
                      </div>
                      <div className={`text-base font-bold ${tod.net_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        ₹{tod.net_pnl.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[var(--muted)]">
                        Win Rate: {tod.win_rate !== null ? `${tod.win_rate.toFixed(1)}%` : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SWING CNC */}
          {activeTab === 'swing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Swing Trades</div>
                  <div className="text-xl font-bold text-[var(--foreground)]">{report.swing.summary.total_trades}</div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    {report.swing.summary.winning_trades}W / {report.swing.summary.losing_trades}L / {report.swing.summary.breakeven_trades}BE
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Swing Net P&L</div>
                  <div
                    className={`text-xl font-bold ${
                      report.swing.summary.net_realized_pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    ₹{report.swing.summary.net_realized_pnl.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    Charges: ₹{report.swing.summary.total_charges.toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Avg Realized R</div>
                  <div className="text-xl font-bold text-[var(--foreground)]">
                    {report.swing.summary.average_realized_r_multiple !== null ? `${report.swing.summary.average_realized_r_multiple.toFixed(2)}R` : 'N/A'}
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-1">
                    Duration: {report.swing.summary.average_holding_days !== null ? `${report.swing.summary.average_holding_days.toFixed(1)} days` : 'N/A'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)]">
                  <div className="text-[11px] text-[var(--muted)] mb-1">Open Swing Risk</div>
                  <div className="text-xl font-bold text-[var(--foreground)]">₹{report.swing.summary.current_open_risk.toFixed(0)}</div>
                  <div className="text-[10px] text-emerald-500 font-medium mt-1">
                    Protected: +₹{report.swing.summary.estimated_protected_profit.toFixed(0)}
                  </div>
                </div>
              </div>

              {/* R-Distribution & Milestones Reached */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span>Realized R-Multiple Distribution</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    {report.swing.summary.r_distribution.map((bucket) => (
                      <div key={bucket.range} className="flex justify-between p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]/60">
                        <span className="font-semibold text-[var(--foreground)]">{bucket.range}</span>
                        <span className="font-bold">{bucket.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Targets Reached & Stop Discipline</span>
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]/60">
                      <span className="text-[var(--foreground)] font-medium">Trades Reaching +1R</span>
                      <span className="font-bold text-blue-500">{report.swing.summary.trades_reaching_r_targets.r1_reached}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]/60">
                      <span className="text-[var(--foreground)] font-medium">Trades Reaching +2R</span>
                      <span className="font-bold text-emerald-500">{report.swing.summary.trades_reaching_r_targets.r2_reached}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]/60">
                      <span className="text-[var(--foreground)] font-medium">Trades Reaching +3R</span>
                      <span className="font-bold text-purple-500">{report.swing.summary.trades_reaching_r_targets.r3_reached}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded-lg bg-[var(--background)] border border-[var(--border)]/60">
                      <span className="text-[var(--foreground)] font-medium">Trades Stopped at Breakeven / Profit</span>
                      <span className="font-bold text-emerald-500">{report.swing.summary.trades_stopped_at_breakeven_or_profit}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRADE LEDGER */}
          {activeTab === 'trades' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  Trade Ledger ({report.trades.length} trades with weekly activity)
                </h3>
                <span className="text-xs text-[var(--muted)]">
                  Click on any trade to inspect execution fills and stop-loss decisions
                </span>
              </div>

              <div className="space-y-3">
                {report.trades.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
                    No trades match the selected weekly period and filter criteria.
                  </div>
                ) : (
                  report.trades.map((trade: ReportTradeItem) => {
                    const isExpanded = expandedTradeId === trade.trade_id;
                    const netPnl = trade.net_realized_pnl;

                    return (
                      <div
                        key={trade.trade_id}
                        className="rounded-xl bg-[var(--card)] border border-[var(--border)] overflow-hidden shadow-xs transition-all"
                      >
                        {/* Trade Row Header */}
                        <div
                          onClick={() => setExpandedTradeId(isExpanded ? null : trade.trade_id)}
                          className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-[var(--border)]/15 select-none"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                trade.direction === 'LONG'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : 'bg-rose-500/10 text-rose-500'
                              }`}
                            >
                              {trade.direction}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[var(--foreground)]">{trade.symbol}</span>
                                <span className="text-[10px] text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
                                  {trade.exchange}
                                </span>
                                <span className="text-[10px] text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--background)] border border-[var(--border)]">
                                  {trade.trade_type}
                                </span>
                                <span className="text-[10px] text-[var(--muted)]">
                                  {trade.portfolio_owner} • {trade.broker}
                                </span>
                              </div>
                              <div className="text-[11px] text-[var(--muted)] mt-0.5">
                                Entry: {new Date(trade.entry_at).toLocaleDateString('en-IN')} @ ₹{trade.entry_price.toFixed(2)} • Qty: {trade.quantity_entered}
                                {trade.exit_price && ` • Exit: ₹${trade.exit_price.toFixed(2)}`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div className="text-right">
                              <div
                                className={`text-sm font-bold ${
                                  netPnl !== null
                                    ? netPnl >= 0
                                      ? 'text-emerald-500'
                                      : 'text-rose-500'
                                    : 'text-[var(--muted)]'
                                }`}
                              >
                                {netPnl !== null ? `${netPnl >= 0 ? '+' : ''}₹${netPnl.toFixed(2)}` : 'OPEN'}
                              </div>
                              <div className="text-[10px] text-[var(--muted)]">
                                {trade.realized_r_multiple !== null
                                  ? `${trade.realized_r_multiple >= 0 ? '+' : ''}${trade.realized_r_multiple.toFixed(2)}R`
                                  : `Risk: ₹${trade.initial_total_risk ? trade.initial_total_risk.toFixed(0) : '0'}`}
                              </div>
                            </div>

                            <div className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)]">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="p-4 bg-[var(--background)]/60 border-t border-[var(--border)] space-y-4 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <span className="text-[var(--muted)] block text-[10px]">Initial Stop Loss</span>
                                <span className="font-semibold text-[var(--foreground)]">₹{trade.initial_stop_loss.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-[var(--muted)] block text-[10px]">Current / Final SL</span>
                                <span className="font-semibold text-[var(--foreground)]">₹{trade.current_stop_loss.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-[var(--muted)] block text-[10px]">Planned Target</span>
                                <span className="font-semibold text-[var(--foreground)]">
                                  {trade.target_price !== null ? `₹${trade.target_price.toFixed(2)}` : 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--muted)] block text-[10px]">Strategy</span>
                                <span className="font-semibold text-[var(--foreground)]">{trade.strategy || 'N/A'}</span>
                              </div>
                            </div>

                            {/* Rationale & Notes */}
                            {(trade.entry_rationale || trade.notes) && (
                              <div className="p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)]/70 space-y-1">
                                {trade.entry_rationale && (
                                  <div>
                                    <span className="text-[10px] text-[var(--muted)] font-semibold block">Rationale:</span>
                                    <span className="text-[11px] text-[var(--foreground)]">{trade.entry_rationale}</span>
                                  </div>
                                )}
                                {trade.notes && (
                                  <div>
                                    <span className="text-[10px] text-[var(--muted)] font-semibold block">Notes:</span>
                                    <span className="text-[11px] text-[var(--foreground)]">{trade.notes}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Stop-Loss Audit Decisions */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-[11px] text-[var(--foreground)] flex items-center gap-1.5">
                                  <ShieldAlert className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Stop-Loss Management History</span>
                                </span>
                                <span className="text-[10px] text-[var(--muted)] italic">
                                  Recorded management decisions (not assumed broker execution)
                                </span>
                              </div>
                              {trade.stop_loss_history.length === 0 ? (
                                <p className="text-[10px] text-[var(--muted)]">No stop-loss adjustments recorded.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {trade.stop_loss_history.map((sl) => (
                                    <div
                                      key={sl.id}
                                      className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)]/60 flex items-center justify-between text-[11px]"
                                    >
                                      <div>
                                        <span className="font-semibold text-[var(--foreground)]">
                                          {sl.sl_level_label}: ₹{sl.new_stop.toFixed(2)}
                                        </span>
                                        {sl.previous_stop !== null && (
                                          <span className="text-[10px] text-[var(--muted)] ml-1.5">
                                            (from ₹{sl.previous_stop.toFixed(2)})
                                          </span>
                                        )}
                                        {sl.notes && <span className="text-[10px] text-[var(--muted)] block">{sl.notes}</span>}
                                      </div>
                                      <div className="text-right text-[10px] text-[var(--muted)]">
                                        <div>{sl.r_multiple_at_update !== null ? `${sl.r_multiple_at_update.toFixed(2)}R` : ''}</div>
                                        <div>{new Date(sl.created_at).toLocaleDateString('en-IN')}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Executions / Fills */}
                            {trade.executions.length > 0 && (
                              <div>
                                <span className="font-bold text-[11px] text-[var(--foreground)] block mb-1.5">
                                  Executions & Partial Exits ({trade.executions.length})
                                </span>
                                <div className="space-y-1">
                                  {trade.executions.map((ex) => (
                                    <div
                                      key={ex.id}
                                      className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)]/60 flex items-center justify-between text-[11px]"
                                    >
                                      <div>
                                        <span className="font-semibold">{ex.execution_type}</span>: {ex.quantity} shares @ ₹{ex.price.toFixed(2)}
                                      </div>
                                      <div className="text-[10px] text-[var(--muted)]">
                                        {new Date(ex.executed_at).toLocaleString('en-IN')}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AI REVIEW INSIGHTS */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <div>
                  <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-400" />
                    <span>AI Review Prompt Context</span>
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Synthesizes execution discipline, stop-loss adherence, and risk changes to feed into your AI trading assistants.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAiPrompt}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-sm transition-all shrink-0 active:scale-[0.98]"
                >
                  {copiedAi ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedAi ? 'Copied Prompt' : 'Copy AI Prompt'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* Negative R Trades */}
                <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
                  <h4 className="font-bold text-[var(--foreground)] text-sm flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                    <span>Negative R Trades ({report.ai_review.trades_with_negative_r.length})</span>
                  </h4>
                  {report.ai_review.trades_with_negative_r.length === 0 ? (
                    <p className="text-[var(--muted)]">No trades closed with negative R.</p>
                  ) : (
                    <div className="space-y-2">
                      {report.ai_review.trades_with_negative_r.map((item) => (
                        <div key={item.trade_id} className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] flex justify-between">
                          <div>
                            <span className="font-bold text-[var(--foreground)]">{item.symbol}</span>
                            <span className="text-[10px] text-[var(--muted)] block">Loss: ₹{Math.abs(item.net_pnl).toFixed(2)}</span>
                          </div>
                          <span className="font-bold text-rose-500">{item.realized_r !== null ? `${item.realized_r.toFixed(2)}R` : 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Risk Increased After Entry */}
                <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
                  <h4 className="font-bold text-[var(--foreground)] text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Risk Increased After Entry ({report.ai_review.trades_where_risk_increased.length})</span>
                  </h4>
                  {report.ai_review.trades_where_risk_increased.length === 0 ? (
                    <p className="text-[var(--muted)]">Excellent discipline! No trades had stop-loss widened after entry.</p>
                  ) : (
                    <div className="space-y-2">
                      {report.ai_review.trades_where_risk_increased.map((item) => (
                        <div key={item.trade_id} className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
                          <div className="flex justify-between">
                            <span className="font-bold text-[var(--foreground)]">{item.symbol}</span>
                            <span className="text-amber-500 font-bold">SL Widened</span>
                          </div>
                          <div className="text-[10px] text-[var(--muted)]">
                            Initial SL: ₹{item.initial_stop_loss.toFixed(2)} → Widened SL: ₹{item.adjusted_stop_loss.toFixed(2)}
                            {item.reason && ` • ${item.reason}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Repeated Symbols */}
                <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
                  <h4 className="font-bold text-[var(--foreground)] text-sm flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-500" />
                    <span>Repeated Symbols ({report.ai_review.repeated_symbols.length})</span>
                  </h4>
                  {report.ai_review.repeated_symbols.length === 0 ? (
                    <p className="text-[var(--muted)]">No multiple entries in the same symbol this week.</p>
                  ) : (
                    <div className="space-y-2">
                      {report.ai_review.repeated_symbols.map((item) => (
                        <div key={item.symbol} className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] flex justify-between">
                          <span className="font-bold text-[var(--foreground)]">{item.symbol}</span>
                          <span className="text-[var(--muted)]">{item.count} trade executions</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Missing Rationale */}
                <div className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
                  <h4 className="font-bold text-[var(--foreground)] text-sm flex items-center gap-2">
                    <Info className="w-4 h-4 text-purple-500" />
                    <span>Missing Trade Rationale ({report.ai_review.missing_rationales.length})</span>
                  </h4>
                  {report.ai_review.missing_rationales.length === 0 ? (
                    <p className="text-[var(--muted)]">All trades have documented entry rationales.</p>
                  ) : (
                    <div className="space-y-2">
                      {report.ai_review.missing_rationales.map((item) => (
                        <div key={item.trade_id} className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] flex justify-between">
                          <span className="font-bold text-[var(--foreground)]">{item.symbol}</span>
                          <span className="text-[10px] text-amber-500">Missing notes/rationale</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: RAW JSON SCHEMA */}
          {activeTab === 'json' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--muted)]">
                  Export Schema v{report.report_version} ({report.report_type})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-semibold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--background)] border border-[var(--border)] font-mono text-[11px] overflow-x-auto max-h-[600px] leading-relaxed text-[var(--foreground)]">
                <pre>{JSON.stringify(report, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
