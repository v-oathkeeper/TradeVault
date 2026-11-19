import React from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { TopBar } from '@/components/layout/TopBar';
import { TradeDetailClient } from '@/components/trades/TradeDetailClient';
import { getTradeMilestoneHistory } from '@/lib/services/gemini-milestone-service';
import type { Trade, StopLossHistoryEntry } from '@/types/app';

interface TradeDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Trade Breakdown',
  description: 'Trade details, Gemini milestone targets, and fee breakdown',
};

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const { id } = await params;
  const appContext = await getHouseholdAppContext();
  const supabase = await createSupabaseServerClient();
  const isAdmin = appContext.isAdmin;

  const [tradeRes, milestoneHistory] = await Promise.all([
    supabase
      .from('trades')
      .select(`
        *,
        portfolio_owner:persons(id, display_name, relationship_label),
        broker:brokers(id, code, name),
        stop_loss_history(*)
      `)
      .eq('id', id)
      .eq('household_id', appContext.householdId)
      .single(),
    getTradeMilestoneHistory(id),
  ]);

  const trade = tradeRes.data;

  if (tradeRes.error || !trade) {
    notFound();
  }

  const breakdown = (trade.charges_breakdown as any) || {};
  const turnover =
    trade.exit_price
      ? (Number(trade.entry_price) + Number(trade.exit_price)) * trade.quantity
      : Number(trade.entry_price) * trade.quantity;

  const returnPct =
    trade.gross_pnl != null && trade.entry_price && trade.quantity
      ? (Number(trade.gross_pnl) / (Number(trade.entry_price) * trade.quantity)) * 100
      : null;

  // Map stop-loss history
  const rawHistory = ((trade as any).stop_loss_history as any[]) ?? [];
  const stopHistory: StopLossHistoryEntry[] = rawHistory
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((h) => ({
      id: h.id,
      tradeId: h.trade_id,
      previousStop: h.previous_stop != null ? Number(h.previous_stop) : null,
      newStop: Number(h.new_stop),
      stopType: h.stop_type,
      marketPriceAtUpdate: h.market_price_at_update != null ? Number(h.market_price_at_update) : null,
      floatingRAtUpdate: null,
      notes: h.notes,
      createdBy: h.created_by,
      createdAt: h.created_at,
    }));

  const tradeData = trade as any;

  const tradeMapped: Trade = {
    id: trade.id,
    householdId: trade.household_id,
    portfolioOwnerId: trade.portfolio_owner_id,
    brokerId: trade.broker_id,
    symbol: trade.symbol,
    exchange: trade.exchange,
    tradeType: trade.trade_type,
    direction: trade.direction,
    quantity: trade.quantity,
    entryPrice: Number(trade.entry_price),
    exitPrice: trade.exit_price != null ? Number(trade.exit_price) : null,
    entryAt: trade.entry_at,
    exitAt: trade.exit_at,
    grossPnl: trade.gross_pnl != null ? Number(trade.gross_pnl) : null,
    totalCharges: Number(trade.total_charges ?? 0),
    netPnl: trade.net_pnl != null ? Number(trade.net_pnl) : null,
    chargesBreakdown: null,
    calculationStatus: trade.calculation_status,
    status: trade.status,
    notes: trade.notes,
    createdBy: trade.created_by,
    updatedBy: trade.updated_by,
    createdAt: trade.created_at,
    updatedAt: trade.updated_at,
    // Gemini Milestones
    milestone1Target: tradeData.milestone1_target != null ? Number(tradeData.milestone1_target) : null,
    milestone1Status: tradeData.milestone1_status,
    milestone1TrailingSl: tradeData.milestone1_trailing_sl != null ? Number(tradeData.milestone1_trailing_sl) : null,
    milestone2Target: tradeData.milestone2_target != null ? Number(tradeData.milestone2_target) : null,
    milestone2Status: tradeData.milestone2_status,
    milestone2TrailingSl: tradeData.milestone2_trailing_sl != null ? Number(tradeData.milestone2_trailing_sl) : null,
    milestone3Target: tradeData.milestone3_target != null ? Number(tradeData.milestone3_target) : null,
    milestone3Status: tradeData.milestone3_status,
    milestone3TrailingSl: tradeData.milestone3_trailing_sl != null ? Number(tradeData.milestone3_trailing_sl) : null,
    currentTrailingSl: tradeData.current_trailing_sl != null ? Number(tradeData.current_trailing_sl) : null,
    lastReachedMilestone: tradeData.last_reached_milestone,
    milestonesUpdatedAt: tradeData.milestones_updated_at,
    // Legacy Stop Loss
    initialStopLoss: tradeData.initial_stop_loss != null ? Number(tradeData.initial_stop_loss) : null,
    currentStopLoss: tradeData.current_stop_loss != null ? Number(tradeData.current_stop_loss) : null,
    strategyName: tradeData.strategy_name,
    broker: trade.broker as any,
    portfolioOwner: trade.portfolio_owner as any,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title={`Trade: ${trade.symbol}`} />
      <TradeDetailClient
        trade={tradeMapped}
        stopHistory={stopHistory}
        milestoneHistory={milestoneHistory}
        isAdmin={isAdmin}
        breakdown={breakdown}
        turnover={turnover}
        returnPct={returnPct}
      />
    </div>
  );
}
