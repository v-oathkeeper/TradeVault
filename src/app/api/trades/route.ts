/**
 * GET /api/trades
 * List trades with server-side filtering, sorting, and pagination.
 * Both ADMIN and VIEWER can access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHouseholdMember } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TradeFiltersSchema } from '@/lib/validation/schemas';
import type { ApiResponse } from '@/types/app';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireHouseholdMember();
    const { searchParams } = request.nextUrl;

    // Parse and validate query params
    const rawParams = {
      personId: searchParams.get('personId') ?? undefined,
      brokerId: searchParams.get('brokerId') ?? undefined,
      tradeType: searchParams.get('tradeType') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      symbol: searchParams.get('symbol') ?? undefined,
      profitLoss: searchParams.get('profitLoss') ?? undefined,
      strategyName: searchParams.get('strategyName') ?? undefined,
      page: searchParams.get('page') ?? '1',
      pageSize: searchParams.get('pageSize') ?? '25',
      sortBy: searchParams.get('sortBy') ?? 'created_at',
      sortOrder: searchParams.get('sortOrder') ?? 'desc',
    };

    const filters = TradeFiltersSchema.parse(rawParams);
    const supabase = await createSupabaseServerClient();

    const offset = (filters.page - 1) * filters.pageSize;

    // Build query
    let query = supabase
      .from('trades')
      .select(
        `
        *,
        portfolio_owner:persons(id, display_name, relationship_label),
        broker:brokers(id, code, name)
        `,
        { count: 'exact' }
      )
      .eq('household_id', ctx.householdId);

    // Apply filters
    if (filters.personId && filters.personId !== 'all') {
      query = query.eq('portfolio_owner_id', filters.personId);
    }
    if (filters.brokerId && filters.brokerId !== 'all') {
      query = query.eq('broker_id', filters.brokerId);
    }
    if (filters.tradeType) {
      query = query.eq('trade_type', filters.tradeType);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.symbol) {
      query = query.ilike('symbol', `%${filters.symbol}%`);
    }
    if (filters.strategyName) {
      query = query.ilike('strategy_name', `%${filters.strategyName}%`);
    }
    if (filters.dateFrom) {
      query = query.gte('entry_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('entry_at', `${filters.dateTo}T23:59:59.999Z`);
    }
    if (filters.profitLoss === 'profit') {
      query = query.gt('net_pnl', 0);
    } else if (filters.profitLoss === 'loss') {
      query = query.lt('net_pnl', 0);
    }

    // Sort — now includes realized_r_multiple
    const sortColumn = filters.sortBy === 'entry_at' ? 'entry_at'
      : filters.sortBy === 'exit_at' ? 'exit_at'
      : filters.sortBy === 'net_pnl' ? 'net_pnl'
      : filters.sortBy === 'symbol' ? 'symbol'
      : filters.sortBy === 'realized_r_multiple' ? 'realized_r_multiple'
      : 'created_at';

    query = query
      .order(sortColumn, { ascending: filters.sortOrder === 'asc' })
      .range(offset, offset + filters.pageSize - 1);

    const { data: trades, error, count } = await query;

    if (error) {
      console.error('Trades fetch error:', error);
      return NextResponse.json<ApiResponse<null>>(
        { error: 'Failed to fetch trades' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: trades,
      total: count ?? 0,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.ceil((count ?? 0) / filters.pageSize),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('GET /api/trades error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Only ADMIN can create trades
    const { requireAdmin } = await import('@/lib/auth/server-auth');
    const ctx = await requireAdmin();

    const body = await request.json();

    // Validate input
    const { CreateTradeSchema } = await import('@/lib/validation/schemas');
    const validated = CreateTradeSchema.parse(body);

    // Verify portfolio owner belongs to this household
    const { requireOwnerInHousehold } = await import('@/lib/auth/server-auth');
    await requireOwnerInHousehold(validated.portfolioOwnerId, ctx.householdId);

    const supabase = await createSupabaseServerClient();

    // Determine status
    const hasExit = validated.exitPrice != null && validated.exitAt != null;
    const status = hasExit ? 'CLOSED' : 'OPEN';

    // Fetch fee rates for calculation
    const { fetchFeeRatesSnapshot } = await import('@/lib/calculations/db-fee-rates');
    const { calculateFeesForTrade } = await import('@/lib/calculations/fee-engine');
    const { calculateGrossPnl } = await import('@/lib/calculations/pnl');
    const { toDecimal } = await import('@/lib/calculations/decimal-utils');
    const { calculateInitialRisk, calculateRealizedR } = await import('@/lib/calculations/r-multiple');

    // Get broker code for fee lookup
    const { data: broker } = await supabase
      .from('brokers')
      .select('code')
      .eq('id', validated.brokerId)
      .single();

    let grossPnl = null;
    let totalCharges = 0;
    let netPnl = null;
    let chargesBreakdown = null;

    if (hasExit && broker) {
      const feeRates = await fetchFeeRatesSnapshot(
        validated.brokerId,
        broker.code as 'KITE' | 'SHOONYA',
        (validated.exchange ?? 'NSE') as 'NSE' | 'BSE',
        validated.tradeType
      );

      const gross = calculateGrossPnl({
        direction: validated.direction,
        entryPrice: validated.entryPrice,
        exitPrice: validated.exitPrice!,
        quantity: validated.quantity,
      });

      const charges = calculateFeesForTrade({
        broker: broker.code as 'KITE' | 'SHOONYA',
        exchange: (validated.exchange ?? 'NSE') as 'NSE' | 'BSE',
        tradeType: validated.tradeType,
        direction: validated.direction,
        entryPrice: validated.entryPrice,
        exitPrice: validated.exitPrice!,
        quantity: validated.quantity,
        feeRates,
        isDpEvent: validated.tradeType === 'DELIVERY',
      });

      grossPnl = gross.toNumber();
      totalCharges = charges.totalCharges;
      netPnl = gross.minus(toDecimal(totalCharges)).toNumber();
      chargesBreakdown = {
        ...charges,
        grossPnl,
        netPnl,
      };
    }

    // ── Compute R-multiple fields ───────────────────────────────
    const riskCalc = calculateInitialRisk({
      entryPrice: validated.entryPrice,
      initialStopLoss: validated.initialStopLoss,
      quantity: validated.quantity,
      direction: validated.direction,
      plannedTarget: validated.plannedTarget,
    });

    let realizedRMultiple: number | null = null;
    let grossRMultiple: number | null = null;

    if (hasExit && riskCalc && netPnl !== null && grossPnl !== null) {
      const rResult = calculateRealizedR({
        netPnl,
        grossPnl,
        riskRupees: riskCalc.riskRupees,
      });
      if (rResult) {
        realizedRMultiple = rResult.realizedR;
        grossRMultiple = rResult.grossR;
      }
    }

    // Insert trade
    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        household_id: ctx.householdId,
        portfolio_owner_id: validated.portfolioOwnerId,
        broker_id: validated.brokerId,
        symbol: validated.symbol,
        exchange: validated.exchange ?? 'NSE',
        trade_type: validated.tradeType,
        direction: validated.direction,
        quantity: validated.quantity,
        entry_price: validated.entryPrice,
        exit_price: validated.exitPrice ?? null,
        entry_at: validated.entryAt,
        exit_at: validated.exitAt ?? null,
        gross_pnl: grossPnl,
        total_charges: totalCharges,
        net_pnl: netPnl,
        charges_breakdown: chargesBreakdown as any,
        status,
        notes: validated.notes ?? null,
        // ── R-Multiple & Risk fields ──
        initial_stop_loss: validated.initialStopLoss,
        initial_risk_per_share: riskCalc?.riskPerShare ?? null,
        initial_risk_rupees: riskCalc?.riskRupees ?? null,
        initial_risk_pct: riskCalc?.riskPct ?? null,
        planned_target: validated.plannedTarget ?? null,
        planned_rr: riskCalc?.plannedRR ?? null,
        r1_price: riskCalc?.r1Price ?? null,
        r2_price: riskCalc?.r2Price ?? null,
        r3_price: riskCalc?.r3Price ?? null,
        strategy_name: validated.strategyName ?? null,
        current_stop_loss: validated.initialStopLoss,
        realized_r_multiple: realizedRMultiple,
        gross_r_multiple: grossRMultiple,
        created_by: ctx.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Trade creation error:', error);
      return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 });
    }

    // Insert initial stop-loss history entry
    if (trade) {
      await supabase.from('stop_loss_history').insert({
        trade_id: trade.id,
        previous_stop: null,
        new_stop: validated.initialStopLoss,
        stop_type: 'INITIAL',
        notes: 'Initial stop-loss set at trade entry',
        created_by: ctx.user.id,
      });
    }

    return NextResponse.json({ data: trade }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AuthError') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.name === 'ZodError') {
        return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 });
      }
    }
    console.error('POST /api/trades error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
