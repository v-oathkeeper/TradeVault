/**
 * GET /api/trades/[id] — Get trade details (with stop-loss history)
 * PUT /api/trades/[id] — Update trade (ADMIN only)
 * DELETE /api/trades/[id] — Delete trade (ADMIN only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHouseholdMember, requireAdmin, requireTradeInHousehold } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UpdateTradeSchema } from '@/lib/validation/schemas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireHouseholdMember();
    const { id } = await params;

    const supabase = await createSupabaseServerClient();

    const { data: trade, error } = await supabase
      .from('trades')
      .select(`
        *,
        portfolio_owner:persons(id, display_name, relationship_label),
        broker:brokers(id, code, name),
        charge_breakdown:trade_charge_breakdowns(*),
        reconciliation:actual_charge_reconciliations(*),
        stop_loss_history(*)
      `)
      .eq('id', id)
      .eq('household_id', ctx.householdId)
      .single();

    if (error || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    return NextResponse.json({ data: trade });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAdmin();
    const { id } = await params;

    // Verify this trade belongs to the admin's household
    await requireTradeInHousehold(id, ctx.householdId);

    const body = await request.json();
    const validated = UpdateTradeSchema.parse({ ...body, id });

    const supabase = await createSupabaseServerClient();

    // Fetch existing trade to fill in missing values for recomputation
    const { data: existing } = await supabase
      .from('trades')
      .select('*')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Determine status
    const exitPrice = validated.exitPrice ?? existing.exit_price;
    const exitAt = validated.exitAt ?? existing.exit_at;
    const hasExit = exitPrice != null && exitAt != null;
    const status = hasExit ? 'CLOSED' : 'OPEN';

    // Build update data
    let updateData: Record<string, unknown> = {
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    };

    if (validated.portfolioOwnerId) updateData.portfolio_owner_id = validated.portfolioOwnerId;
    if (validated.brokerId) updateData.broker_id = validated.brokerId;
    if (validated.symbol) updateData.symbol = validated.symbol;
    if (validated.exchange) updateData.exchange = validated.exchange;
    if (validated.tradeType) updateData.trade_type = validated.tradeType;
    if (validated.direction) updateData.direction = validated.direction;
    if (validated.quantity !== undefined) updateData.quantity = validated.quantity;
    if (validated.entryPrice !== undefined) updateData.entry_price = validated.entryPrice;
    if (validated.entryAt) updateData.entry_at = validated.entryAt;
    updateData.exit_price = exitPrice ?? null;
    updateData.exit_at = exitAt ?? null;
    updateData.status = status;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.strategyName !== undefined) updateData.strategy_name = validated.strategyName;
    if (validated.plannedTarget !== undefined) updateData.planned_target = validated.plannedTarget;

    // ── Recompute R-multiple fields if stop-loss or entry changed ──
    const { calculateInitialRisk, calculateRealizedR } = await import('@/lib/calculations/r-multiple');

    const effectiveEntry = (validated.entryPrice ?? Number(existing.entry_price));
    const effectiveStop = (validated.initialStopLoss ?? Number(existing.initial_stop_loss));
    const effectiveQty = (validated.quantity ?? existing.quantity);
    const effectiveDir = (validated.direction ?? existing.direction) as 'LONG' | 'SHORT';
    const effectiveTarget = (validated.plannedTarget ?? (existing.planned_target ? Number(existing.planned_target) : null));

    if (validated.initialStopLoss) {
      updateData.initial_stop_loss = validated.initialStopLoss;
      updateData.current_stop_loss = validated.initialStopLoss;
    }

    if (effectiveStop && effectiveEntry) {
      const riskCalc = calculateInitialRisk({
        entryPrice: effectiveEntry,
        initialStopLoss: effectiveStop,
        quantity: effectiveQty,
        direction: effectiveDir,
        plannedTarget: effectiveTarget,
      });

      if (riskCalc) {
        updateData.initial_risk_per_share = riskCalc.riskPerShare;
        updateData.initial_risk_rupees = riskCalc.riskRupees;
        updateData.initial_risk_pct = riskCalc.riskPct;
        updateData.planned_rr = riskCalc.plannedRR;
        updateData.r1_price = riskCalc.r1Price;
        updateData.r2_price = riskCalc.r2Price;
        updateData.r3_price = riskCalc.r3Price;
      }
    }

    // Recalculate P&L and fees if now closed
    if (hasExit && exitPrice) {
      const effectiveBrokerId = validated.brokerId ?? existing.broker_id;
      const effectiveExchange = (validated.exchange ?? existing.exchange) as 'NSE' | 'BSE';
      const effectiveTradeType = (validated.tradeType ?? existing.trade_type) as 'INTRADAY' | 'DELIVERY';

      const { data: broker } = await supabase
        .from('brokers')
        .select('code')
        .eq('id', effectiveBrokerId)
        .single();

      if (broker) {
        const { fetchFeeRatesSnapshot } = await import('@/lib/calculations/db-fee-rates');
        const { calculateFeesForTrade } = await import('@/lib/calculations/fee-engine');
        const { calculateGrossPnl } = await import('@/lib/calculations/pnl');
        const { toDecimal } = await import('@/lib/calculations/decimal-utils');

        const feeRates = await fetchFeeRatesSnapshot(
          effectiveBrokerId,
          broker.code as 'KITE' | 'SHOONYA',
          effectiveExchange,
          effectiveTradeType
        );

        const gross = calculateGrossPnl({
          direction: effectiveDir,
          entryPrice: effectiveEntry,
          exitPrice,
          quantity: effectiveQty,
        });

        const charges = calculateFeesForTrade({
          broker: broker.code as 'KITE' | 'SHOONYA',
          exchange: effectiveExchange,
          tradeType: effectiveTradeType,
          direction: effectiveDir,
          entryPrice: effectiveEntry,
          exitPrice,
          quantity: effectiveQty,
          feeRates,
          isDpEvent: effectiveTradeType === 'DELIVERY',
        });

        const grossPnl = gross.toNumber();
        const totalCharges = charges.totalCharges;
        const netPnl = gross.minus(toDecimal(totalCharges)).toNumber();

        updateData.gross_pnl = grossPnl;
        updateData.total_charges = totalCharges;
        updateData.net_pnl = netPnl;
        updateData.charges_breakdown = { ...charges, grossPnl, netPnl };

        // Compute realized R on close
        const riskRupees = effectiveStop && effectiveEntry
          ? Math.abs(effectiveEntry - effectiveStop) * effectiveQty
          : null;

        if (riskRupees && riskRupees > 0) {
          const rResult = calculateRealizedR({ netPnl, grossPnl, riskRupees });
          if (rResult) {
            updateData.realized_r_multiple = rResult.realizedR;
            updateData.gross_r_multiple = rResult.grossR;
          }
        }
      }
    } else if (!hasExit) {
      // Trade re-opened — clear realized R
      updateData.realized_r_multiple = null;
      updateData.gross_r_multiple = null;
    }

    const { data: updated, error } = await supabase
      .from('trades')
      .update(updateData as any)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update trade' }, { status: 500 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AuthError') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.name === 'ZodError') {
        return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
      }
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAdmin();
    const { id } = await params;

    await requireTradeInHousehold(id, ctx.householdId);

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('trades')
      .delete()
      .eq('id', id)
      .eq('household_id', ctx.householdId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete trade' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Trade deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
