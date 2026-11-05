'use client';

import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileJson,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { useUser } from '@/components/providers/UserContext';
import { toast } from 'sonner';

export function ExportClient() {
  const { isAdmin, persons, getPersonLabel } = useUser();
  const [selectedPerson, setSelectedPerson] = useState('all');
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center rounded-2xl bg-[var(--card)] border border-[var(--border)] max-w-md mx-auto my-12 space-y-3">
        <Shield className="w-12 h-12 mx-auto text-amber-500" />
        <h3 className="text-lg font-bold">Admin Only Feature</h3>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Data export functionality is currently reserved for the Husband (Admin) account.
        </p>
      </div>
    );
  }

  const handleDownload = async (format: 'csv' | 'xlsx' | 'json') => {
    setDownloadingFormat(format);
    try {
      const url = `/api/exports?format=${format}&personId=${selectedPerson}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Export download failed');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `tradevault-export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Exported ${format.toUpperCase()} successfully`);
    } catch (err: any) {
      toast.error('Failed to export data', { description: err.message });
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Export Center
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Download complete trading records, tax sheets, and backup archives
        </p>
      </div>

      {/* Person Scope Selector */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-2">
        <label className="text-xs font-semibold text-[var(--foreground)]">
          Export Scope
        </label>
        <select
          value={selectedPerson}
          onChange={(e) => setSelectedPerson(e.target.value)}
          className="w-full sm:w-64 px-3.5 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-medium focus:border-blue-500 transition-colors"
        >
          <option value="all">All Portfolios (Combined)</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {getPersonLabel(p.id)}'s Portfolio Only
            </option>
          ))}
        </select>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Excel XLSX */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[var(--foreground)]">
              Excel Workbook (.xlsx)
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Formatted multi-column spreadsheet with frozen headers and formulas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('xlsx')}
            disabled={Boolean(downloadingFormat)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {downloadingFormat === 'xlsx' ? 'Exporting...' : 'Download XLSX'}
            </span>
          </button>
        </div>

        {/* CSV */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[var(--foreground)]">
              Raw Data (.csv)
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Universal comma-separated values compatible with Google Sheets and tax software.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('csv')}
            disabled={Boolean(downloadingFormat)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {downloadingFormat === 'csv' ? 'Exporting...' : 'Download CSV'}
            </span>
          </button>
        </div>

        {/* JSON Backup */}
        <div className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <FileJson className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[var(--foreground)]">
              Complete JSON Archive
            </h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Full machine-readable database dump including nested charge breakdown JSON snapshots.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDownload('json')}
            disabled={Boolean(downloadingFormat)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {downloadingFormat === 'json' ? 'Exporting...' : 'Download JSON'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
