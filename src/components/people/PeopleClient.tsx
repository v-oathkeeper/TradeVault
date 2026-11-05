'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, Shield, Edit2, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PnlDisplay } from '@/components/ui/PnlDisplay';
import { formatINR } from '@/lib/utils';
import { useUser } from '@/components/providers/UserContext';
import { toast } from 'sonner';
import type { Trade } from '@/types/app';

interface PeopleClientProps {
  initialTrades: Trade[];
}

export function PeopleClient({ initialTrades }: PeopleClientProps) {
  const router = useRouter();
  const { persons, getPersonLabel, isAdmin } = useUser();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const personStats = persons.map((person) => {
    const pTrades = initialTrades.filter(
      (t) => t.portfolioOwnerId === person.id && t.status === 'CLOSED'
    );
    const pOpen = initialTrades.filter(
      (t) => t.portfolioOwnerId === person.id && t.status === 'OPEN'
    );

    const net = pTrades.reduce((acc, t) => acc + (t.netPnl ?? 0), 0);
    const charges = pTrades.reduce((acc, t) => acc + (t.totalCharges ?? 0), 0);
    const wins = pTrades.filter((t) => (t.netPnl ?? 0) > 0).length;
    const winRate = pTrades.length > 0 ? (wins / pTrades.length) * 100 : 0;
    const invested = pOpen.reduce(
      (acc, t) => acc + Number(t.entryPrice) * t.quantity,
      0
    );

    return {
      person,
      dynamicLabel: getPersonLabel(person.id),
      totalClosed: pTrades.length,
      openCount: pOpen.length,
      netPnl: net,
      chargesPaid: charges,
      winRate,
      capitalDeployed: invested,
    };
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
          Family Portfolio Owners
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Independent tracking portfolios for each family member in the shared household
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {personStats.map((item) => (
          <div
            key={item.person.id}
            className="p-6 rounded-3xl bg-[var(--card)] border border-[var(--border)] shadow-sm space-y-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-base font-mono">
                  {item.dynamicLabel.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">
                      {item.dynamicLabel}
                    </h3>
                    <Badge variant="default">
                      {item.person.relationshipLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    System ID: {item.person.displayName}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block">
                  Net Return
                </span>
                <PnlDisplay value={item.netPnl} size="lg" />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs">
              <div>
                <span className="text-[10px] text-[var(--muted)] block uppercase">
                  Closed Trades
                </span>
                <span className="text-sm font-bold">{item.totalClosed}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--muted)] block uppercase">
                  Win Rate
                </span>
                <span className="text-sm font-bold text-emerald-500">
                  {item.winRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--muted)] block uppercase">
                  Open Positions
                </span>
                <span className="text-sm font-bold">{item.openCount}</span>
              </div>
              <div>
                <span className="text-[10px] text-[var(--muted)] block uppercase">
                  Charges Paid
                </span>
                <span className="text-sm font-bold text-amber-500">
                  {formatINR(item.chargesPaid)}
                </span>
              </div>
            </div>

            {/* Capital note */}
            <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-1">
              <span>Capital Deployed:</span>
              <span className="font-mono font-semibold text-[var(--foreground)]">
                {formatINR(item.capitalDeployed)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
