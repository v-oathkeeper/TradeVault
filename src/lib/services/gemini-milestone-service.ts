/**
 * TradeVault — Gemini Milestone Service
 *
 * Handles importing, previewing, and persisting Gemini milestone & trailing stop-loss data.
 * Pure storage and audit trail — does not calculate milestones itself.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  parseAndValidateGeminiJson,
  type NormalizedGeminiMilestones,
  type TradeDetailsItem,
} from '@/lib/validation/gemini-schema';
import type { TradeMilestoneHistoryEntry } from '@/types/app';

export interface MilestonePreviewResult {
  valid: boolean;
  error?: string;
  matchedTrade?: {
    id: string;
    symbol: string;
    entryPrice: number;
    ownerName: string;
    ownerLabel: string;
    status: string;
    tradeType: string;
  } | null;
  tradeDetails?: TradeDetailsItem;
  milestones?: NormalizedGeminiMilestones;
}

/**
 * Validates Gemini JSON and optionally resolves the associated trade.
 */
export async function previewGeminiMilestones(
  householdId: string,
  jsonText: string,
  targetTradeId?: string
): Promise<MilestonePreviewResult> {
  const parsed = parseAndValidateGeminiJson(jsonText);
  if (!parsed.success || !parsed.data) {
    return { valid: false, error: parsed.error };
  }

  const supabase = await createSupabaseServerClient();
  const tradeIdToMatch = targetTradeId || parsed.data.tradeId;

  let query = supabase
    .from('trades')
    .select(`
      id, symbol, entry_price, status, trade_type,
      portfolio_owner:persons(id, display_name, relationship_label)
    `)
    .eq('household_id', householdId);

  if (tradeIdToMatch) {
    query = query.eq('id', tradeIdToMatch);
  } else if (parsed.data.symbol) {
    // Prefer the most recent open trade with same symbol
    query = query
      .eq('symbol', parsed.data.symbol)
      .order('entry_at', { ascending: false });
  }

  const { data: trades, error } = await query.limit(1);

  if (error) {
    return { valid: false, error: `Failed to search trades: ${error.message}` };
  }

  const matched = trades && trades.length > 0 ? trades[0] : null;

  return {
    valid: true,
    matchedTrade: matched
      ? {
          id: matched.id,
          symbol: matched.symbol,
          entryPrice: Number(matched.entry_price),
          ownerName: (matched.portfolio_owner as any)?.display_name ?? 'Unknown',
          ownerLabel: (matched.portfolio_owner as any)?.relationship_label ?? '',
          status: matched.status,
          tradeType: matched.trade_type,
        }
      : null,
    tradeDetails: parsed.data.tradeDetails,
    milestones: parsed.data,
  };
}

/**
 * Saves imported Gemini milestone data against a trade.
 * Persists in `trade_milestone_history` and updates `trades`.
 * If current trailing stop-loss is set, also appends to `stop_loss_history`.
 */
export async function applyGeminiMilestones(
  householdId: string,
  userId: string,
  tradeId: string,
  milestonesData: NormalizedGeminiMilestones,
  rawJson?: unknown
): Promise<{ success: boolean; historyEntryId: string; tradeId: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. Verify trade exists and belongs to household
  const { data: existingTrade, error: fetchError } = await supabase
    .from('trades')
    .select('id, current_stop_loss, symbol')
    .eq('id', tradeId)
    .eq('household_id', householdId)
    .single();

  if (fetchError || !existingTrade) {
    throw new Error('Trade not found or access denied.');
  }

  const m1 = milestonesData.milestone1;
  const m2 = milestonesData.milestone2;
  const m3 = milestonesData.milestone3;
  const currentTrailingSl = milestonesData.currentTrailingStopLoss;
  const updatedAt = milestonesData.timestamp || new Date().toISOString();

  // 2. Insert into trade_milestone_history
  const { data: historyData, error: historyError } = await (supabase as any)
    .from('trade_milestone_history')
    .insert({
      trade_id: tradeId,
      milestone1_target: m1.targetPrice,
      milestone1_status: m1.status,
      milestone1_trailing_sl: m1.trailingStopLoss,
      milestone2_target: m2.targetPrice,
      milestone2_status: m2.status,
      milestone2_trailing_sl: m2.trailingStopLoss,
      milestone3_target: m3.targetPrice,
      milestone3_status: m3.status,
      milestone3_trailing_sl: m3.trailingStopLoss,
      current_trailing_sl: currentTrailingSl,
      last_reached_milestone: milestonesData.lastReachedMilestone,
      notes: milestonesData.notes || null,
      raw_gemini_input: rawJson ? JSON.parse(JSON.stringify(rawJson)) : null,
      created_by: userId,
      created_at: updatedAt,
    })
    .select('id')
    .single();

  if (historyError) {
    // If table doesn't exist yet, we still update the trades table
    console.warn('trade_milestone_history insert error:', historyError.message);
  }

  // 3. Update trades table
  const updatePayload: Record<string, unknown> = {
    milestone1_target: m1.targetPrice,
    milestone1_status: m1.status,
    milestone1_trailing_sl: m1.trailingStopLoss,
    milestone2_target: m2.targetPrice,
    milestone2_status: m2.status,
    milestone2_trailing_sl: m2.trailingStopLoss,
    milestone3_target: m3.targetPrice,
    milestone3_status: m3.status,
    milestone3_trailing_sl: m3.trailingStopLoss,
    current_trailing_sl: currentTrailingSl,
    last_reached_milestone: milestonesData.lastReachedMilestone,
    milestones_updated_at: updatedAt,
    updated_by: userId,
  };

  // If a current trailing stop-loss was provided, update current_stop_loss as well
  if (currentTrailingSl != null) {
    updatePayload.current_stop_loss = currentTrailingSl;

    // Also record in stop_loss_history for the audit trail
    const prevStop = existingTrade.current_stop_loss != null ? Number(existingTrade.current_stop_loss) : null;
    await supabase.from('stop_loss_history').insert({
      trade_id: tradeId,
      previous_stop: prevStop,
      new_stop: currentTrailingSl,
      stop_type: 'TRAIL',
      notes: milestonesData.notes ? `Gemini update: ${milestonesData.notes}` : 'Gemini milestone trailing SL update',
      created_by: userId,
      created_at: updatedAt,
    });
  }

  const { error: updateError } = await supabase
    .from('trades')
    .update(updatePayload as any)
    .eq('id', tradeId)
    .eq('household_id', householdId);

  if (updateError) {
    throw new Error(`Failed to update trade milestones: ${updateError.message}`);
  }

  return {
    success: true,
    historyEntryId: (historyData as any)?.id ?? '',
    tradeId,
  };
}

/**
 * Fetches milestone history for a trade.
 */
export async function getTradeMilestoneHistory(
  tradeId: string
): Promise<TradeMilestoneHistoryEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from('trade_milestone_history')
    .select('*')
    .eq('trade_id', tradeId)
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    tradeId: row.trade_id,
    milestone1Target: row.milestone1_target != null ? Number(row.milestone1_target) : null,
    milestone1Status: row.milestone1_status,
    milestone1TrailingSl: row.milestone1_trailing_sl != null ? Number(row.milestone1_trailing_sl) : null,
    milestone2Target: row.milestone2_target != null ? Number(row.milestone2_target) : null,
    milestone2Status: row.milestone2_status,
    milestone2TrailingSl: row.milestone2_trailing_sl != null ? Number(row.milestone2_trailing_sl) : null,
    milestone3Target: row.milestone3_target != null ? Number(row.milestone3_target) : null,
    milestone3Status: row.milestone3_status,
    milestone3TrailingSl: row.milestone3_trailing_sl != null ? Number(row.milestone3_trailing_sl) : null,
    currentTrailingSl: row.current_trailing_sl != null ? Number(row.current_trailing_sl) : null,
    lastReachedMilestone: row.last_reached_milestone,
    notes: row.notes,
    rawGeminiInput: row.raw_gemini_input,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}
