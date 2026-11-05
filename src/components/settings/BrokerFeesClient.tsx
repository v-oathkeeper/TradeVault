'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, ExternalLink, ShieldCheck, Info } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatINR } from '@/lib/utils';

export function BrokerFeesClient() {
  const kiteFees = [
    {
      type: 'Brokerage (Intraday)',
      rate: '0.03% or ₹20/order (whichever is lower)',
      side: 'Both (Buy & Sell)',
      statutory: false,
    },
    {
      type: 'Brokerage (Delivery)',
      rate: '₹0 (Zero Brokerage)',
      side: 'Both',
      statutory: false,
    },
    {
      type: 'STT (Intraday)',
      rate: '0.025% on turnover',
      side: 'Sell side only',
      statutory: true,
    },
    {
      type: 'STT (Delivery)',
      rate: '0.1% on turnover',
      side: 'Both (Buy & Sell)',
      statutory: true,
    },
    {
      type: 'Exchange Txn (NSE)',
      rate: '0.00297% - 0.00307% on turnover',
      side: 'Both',
      statutory: true,
    },
    {
      type: 'Exchange Txn (BSE)',
      rate: '0.00375% on turnover',
      side: 'Both',
      statutory: true,
    },
    {
      type: 'GST',
      rate: '18% on (Brokerage + Exch Txn + SEBI)',
      side: 'Both',
      statutory: true,
    },
    {
      type: 'SEBI Charges',
      rate: '₹10 / crore (0.0001%)',
      side: 'Both',
      statutory: true,
    },
    {
      type: 'Stamp Duty (Intraday)',
      rate: '0.003% on buy value',
      side: 'Buy side only',
      statutory: true,
    },
    {
      type: 'Stamp Duty (Delivery)',
      rate: '0.015% on buy value',
      side: 'Buy side only',
      statutory: true,
    },
    {
      type: 'DP Charges',
      rate: '₹15.34 flat per scrip on sell',
      side: 'Delivery sell only',
      statutory: false,
    },
  ];

  const shoonyaFees = [
    {
      type: 'Brokerage (Intraday)',
      rate: '0.03% capped at ₹5/order',
      side: 'Both (Buy & Sell)',
      statutory: false,
    },
    {
      type: 'Brokerage (Delivery)',
      rate: '₹0 (Zero Brokerage)',
      side: 'Both',
      statutory: false,
    },
    {
      type: 'STT (Intraday)',
      rate: '0.025% on turnover',
      side: 'Sell side only',
      statutory: true,
    },
    {
      type: 'STT (Delivery)',
      rate: '0.1% on turnover',
      side: 'Both (Buy & Sell)',
      statutory: true,
    },
    {
      type: 'Exchange Txn',
      rate: 'NSE 0.00307% / BSE 0.00307%',
      side: 'Both',
      statutory: true,
    },
    {
      type: 'GST',
      rate: '18% on service charges',
      side: 'Both',
      statutory: true,
    },
    {
      type: 'SEBI Charges',
      rate: '₹10 / crore (0.0001%)',
      side: 'Both',
      statutory: true,
    },
    {
      type: 'Stamp Duty',
      rate: '0.003% intraday / 0.015% delivery',
      side: 'Buy side only',
      statutory: true,
    },
    {
      type: 'DP Charges',
      rate: '₹9.00 flat per scrip on sell',
      side: 'Delivery sell only',
      statutory: false,
    },
    {
      type: 'IPFT Charges',
      rate: '₹0.01 / crore (NSE)',
      side: 'Both',
      statutory: true,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Settings</span>
        </Link>
        <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Broker Tariff & Statutory Fee Rates
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Configured rates active in the database calculation engine
        </p>
      </div>

      {/* Info notice */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 text-xs text-blue-500">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Configurable & Historical Rates</span>
          <p className="opacity-90 leading-relaxed text-[var(--foreground)]">
            These schedules are stored in the PostgreSQL database table{' '}
            <code className="font-mono px-1 py-0.5 bg-[var(--card)] rounded">broker_fee_rates</code> with effective date intervals. Trades calculate charges using snapshot rates for their respective execution dates.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zerodha Kite Schedule */}
        <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Badge variant="kite" className="text-xs px-2.5 py-1">
                KITE
              </Badge>
              <h3 className="font-bold text-base text-[var(--foreground)]">
                Zerodha Kite Schedule
              </h3>
            </div>
            <a
              href="https://zerodha.com/charges"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
            >
              <span>Source</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="divide-y divide-[var(--border)] text-xs font-mono">
            {kiteFees.map((fee, idx) => (
              <div key={idx} className="py-2.5 flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium font-sans text-[var(--foreground)] block">
                    {fee.type}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">
                    {fee.side}
                  </span>
                </div>
                <span className="font-semibold text-right text-blue-500">
                  {fee.rate}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Shoonya Schedule */}
        <div className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Badge variant="shoonya" className="text-xs px-2.5 py-1">
                SHOONYA
              </Badge>
              <h3 className="font-bold text-base text-[var(--foreground)]">
                Shoonya Schedule
              </h3>
            </div>
            <a
              href="https://shoonya.com/pricing"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-500 hover:underline inline-flex items-center gap-1"
            >
              <span>Source</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="divide-y divide-[var(--border)] text-xs font-mono">
            {shoonyaFees.map((fee, idx) => (
              <div key={idx} className="py-2.5 flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium font-sans text-[var(--foreground)] block">
                    {fee.type}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">
                    {fee.side}
                  </span>
                </div>
                <span className="font-semibold text-right text-indigo-500">
                  {fee.rate}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
