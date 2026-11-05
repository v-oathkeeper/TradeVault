/**
 * PATCH /api/trades/[id]/stop-loss
 * 
 * Admin-only endpoint to update the current stop-loss for an open position.
 * Creates an audit entry in stop_loss_history.
 * 
 * Body:
 *   newStopLoss: number          — required
 *   stopType: StopLossUpdateType — TRAIL | BREAKEVEN | PARTIAL_CLOSE | MANUAL
 *   marketPriceAtUpdate?: number — current market price (for MAE/MFE tracking)
 *   notes?: string               — optional note
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireTradeInHousehold } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UpdateStopLossSchema } from '@/lib/validation/schemas';
import { validateTrailingStopUpdate, calculateFloatingR } from '@/lib/calculations/r-multiple';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAdmin();
    const { id } = await params;

    // Verify trade belongs to this household
    await requireTradeInHousehold(id, ctx.householdId);

    const body = await request.json();
    const validated = UpdateStopLossSchema.parse(body);

    const supabase = await createSupabaseServerClient();

    // Fetch current trade state
    const { data: trade, error: fetchError } = await supabase
      .from('trades')
      .select('id, status, direction, entry_price, current_stop_loss, initial_risk_rupees')
      .eq('id', id)
      .single();

    if (fetchError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Can only update stop-loss on OPEN positions
    if (trade.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Cannot update stop-loss on a closed trade' },
        { status: 400 }
      );
    }

    const currentStop = trade.current_stop_loss ? Number(trade.current_stop_loss) : null;
    const direction = trade.direction as 'LONG' | 'SHORT';
    const entryPrice = Number(trade.entry_price);

    // Validate stop-loss update (trail direction enforcement)
    if (currentStop !== null && validated.stopType === 'TRAIL') {
      const validation = validateTrailingStopUpdate(
        direction,
        currentStop,
        validated.newStopLoss,
        entryPrice
      );
      if (!validation.valid) {
        return NextResponse.json({ error: validation.message }, { status: 400 });
      }
    }

    // Compute floating R at time of update (if market price provided)
    let floatingRAtUpdate: number | null = null;
    if (validated.marketPriceAtUpdate && trade.initial_risk_rupees) {
      const riskRupees = Number(trade.initial_risk_rupees);
      // Rough unrealized P&L based on market price vs entry
      const qty = 1; // We use riskRupees directly for ratio
      const priceDiff = direction === 'LONG'
        ? validated.marketPriceAtUpdate - entryPrice
        : entryPrice - validated.marketPriceAtUpdate;
      // floatingR = unrealized_pnl_per_share_ratio vs risk_per_share
      // Since we don't have quantity here, use the ratio of price movements
      const riskPerShare = riskRupees; // approximation if qty=1 not stored here
      floatingRAtUpdate = calculateFloatingR(priceDiff, riskPerShare / 1);
    }

    // Also update MAE / MFE if market price is provided
    const maeUpdates: Record<string, unknown> = {};
    if (validated.marketPriceAtUpdate) {
      const mp = validated.marketPriceAtUpdate;

      // Fetch current MAE/MFE
      const { data: tradeDetails } = await supabase
        .from('trades')
        .select('max_adverse_excursion, max_favorable_excursion')
        .eq('id', id)
        .single();

      if (tradeDetails) {
        const currentMAE = tradeDetails.max_adverse_excursion
          ? Number(tradeDetails.max_adverse_excursion)
          : mp;
        const currentMFE = tradeDetails.max_favorable_excursion
          ? Number(tradeDetails.max_favorable_excursion)
          : mp;

        // For LONG: adverse = price going down, favorable = price going up
        if (direction === 'LONG') {
          maeUpdates.max_adverse_excursion = Math.min(currentMAE, mp);
          maeUpdates.max_favorable_excursion = Math.max(currentMFE, mp);
        } else {
          // For SHORT: adverse = price going up, favorable = price going down
          maeUpdates.max_adverse_excursion = Math.max(currentMAE, mp);
          maeUpdates.max_favorable_excursion = Math.min(currentMFE, mp);
        }
      }
    }

    // Update trade's current_stop_loss (and optionally MAE/MFE)
    const { error: updateError } = await supabase
      .from('trades')
      .update({
        current_stop_loss: validated.newStopLoss,
        ...maeUpdates,
        updated_by: ctx.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Stop-loss update error:', updateError);
      return NextResponse.json({ error: 'Failed to update stop-loss' }, { status: 500 });
    }

    // Insert stop-loss history entry
    const { data: historyEntry, error: historyError } = await supabase
      .from('stop_loss_history')
      .insert({
        trade_id: id,
        previous_stop: currentStop,
        new_stop: validated.newStopLoss,
        stop_type: validated.stopType,
        market_price_at_update: validated.marketPriceAtUpdate ?? null,
        floating_r_at_update: floatingRAtUpdate,
        notes: validated.notes ?? null,
        created_by: ctx.user.id,
      })
      .select()
      .single();

    if (historyError) {
      console.error('Stop-loss history insert error:', historyError);
      // Non-fatal — the update already succeeded
    }

    return NextResponse.json({
      message: 'Stop-loss updated successfully',
      data: {
        previousStop: currentStop,
        newStop: validated.newStopLoss,
        stopType: validated.stopType,
        historyEntry,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AuthError') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.name === 'ZodError') {
        return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 });
      }
    }
    console.error('PATCH stop-loss error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/trades/[id]/stop-loss
 * Returns full stop-loss history for a trade.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAdmin();
    const { id } = await params;

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('stop_loss_history')
      .select('*')
      .eq('trade_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch stop-loss history' }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
