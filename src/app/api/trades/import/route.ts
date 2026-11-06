/**
 * POST /api/trades/import
 *
 * Executes the actual import of validated trades.
 * Creates actual trade records in `trades` table with OPEN status,
 * computes initial risk snapshots, sets current_stop_loss = initial_stop_loss,
 * and creates initial records in `stop_loss_history`.
 *
 * Security:
 * - ADMIN role required (VIEWER gets 403).
 * - Portfolio owners validated against the authenticated user's household.
 * - Atomic execution via database transaction / compensating rollback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  parseRawJsonText,
  validateTradesPayload,
  executeTradeImport,
  type PersonContext,
  type BrokerContext,
  type ExistingTradeContext,
} from '@/lib/services/trade-import-service';

export async function POST(request: NextRequest) {
  try {
    // 1. Strict Server-Side Authorization: Admin only
    const ctx = await requireAdmin();

    const body = await request.json();
    let rawTrades: Record<string, unknown>[] = [];
    let schemaVersion = '1.0';

    if (typeof body.jsonText === 'string') {
      const parseResult = parseRawJsonText(body.jsonText);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: parseResult.error || 'Invalid JSON syntax' },
          { status: 400 }
        );
      }
      rawTrades = parseResult.rawTrades!;
      schemaVersion = parseResult.schemaVersion!;
    } else if (body.trades && Array.isArray(body.trades)) {
      // Direct validated trades or raw trades payload
      rawTrades = body.trades;
      schemaVersion = body.schema_version || '1.0';
    } else {
      return NextResponse.json(
        { error: 'Missing jsonText or trades payload in request body' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 2. Fetch household portfolio owners to verify authorization server-side
    const { data: personsData, error: personsError } = await supabase
      .from('persons')
      .select('id, household_id, display_name, relationship_label, is_active')
      .eq('household_id', ctx.householdId)
      .eq('is_active', true);

    if (personsError) {
      console.error('Failed to fetch household persons:', personsError);
      return NextResponse.json(
        { error: 'Failed to fetch household persons' },
        { status: 500 }
      );
    }

    const persons: PersonContext[] = personsData || [];

    // 3. Fetch active brokers
    const { data: brokersData, error: brokersError } = await supabase
      .from('brokers')
      .select('id, code, name, is_active')
      .eq('is_active', true);

    if (brokersError) {
      console.error('Failed to fetch brokers:', brokersError);
      return NextResponse.json(
        { error: 'Failed to fetch active brokers' },
        { status: 500 }
      );
    }

    const brokers: BrokerContext[] = brokersData || [];

    // 4. Fetch existing open trades for duplicate check
    const { data: openTradesData } = await supabase
      .from('trades')
      .select(
        'id, symbol, portfolio_owner_id, broker_id, entry_price, quantity, direction, status, created_at'
      )
      .eq('household_id', ctx.householdId)
      .eq('status', 'OPEN');

    const existingOpenTrades: ExistingTradeContext[] = (openTradesData || []).map(
      (t) => ({
        id: t.id,
        symbol: t.symbol,
        portfolio_owner_id: t.portfolio_owner_id,
        broker_id: t.broker_id,
        entry_price: Number(t.entry_price),
        quantity: t.quantity,
        direction: t.direction,
        status: t.status,
        created_at: t.created_at,
      })
    );

    // 5. Server-side validation before any database write
    const validation = validateTradesPayload({
      rawTrades,
      schemaVersion,
      householdId: ctx.householdId,
      userRole: ctx.role,
      persons,
      brokers,
      existingOpenTrades,
    });

    if (!validation.isValid) {
      const firstError =
        validation.trades.find((t) => !t.isValid)?.errors[0] ||
        'Validation failed for one or more trades';
      return NextResponse.json(
        {
          error: `Import rejected: ${firstError}`,
          validation,
        },
        { status: 400 }
      );
    }

    // 6. Execute atomic batch import
    const result = await executeTradeImport({
      validatedTrades: validation.trades,
      householdId: ctx.householdId,
      userId: ctx.user.id,
      supabase,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to import trades into database',
          summary: result.summary,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        importedCount: result.importedCount,
        tradeIds: result.tradeIds,
        summary: result.summary,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AuthError') {
      const statusCode = 'statusCode' in error ? (error as { statusCode: number }).statusCode : 403;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('POST /api/trades/import error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
