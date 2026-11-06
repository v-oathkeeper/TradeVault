/**
 * POST /api/trades/import/validate
 *
 * Validates a JSON trade import payload without inserting any records.
 * Generates an itemized preview with calculated risk metrics, broker mappings,
 * portfolio owner resolutions, and duplicate detection warnings.
 *
 * Security: ADMIN users only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  parseRawJsonText,
  validateTradesPayload,
  type PersonContext,
  type BrokerContext,
  type ExistingTradeContext,
} from '@/lib/services/trade-import-service';

export async function POST(request: NextRequest) {
  try {
    // 1. Strict Server-Side Authorization: Admin only
    const ctx = await requireAdmin();

    const body = await request.json();
    const jsonText =
      typeof body.jsonText === 'string'
        ? body.jsonText
        : typeof body === 'object'
        ? JSON.stringify(body)
        : '';

    // 2. Parse Raw JSON
    const parseResult = parseRawJsonText(jsonText);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          isValid: false,
          schemaVersion: '1.0',
          totalTrades: 0,
          validTradesCount: 0,
          invalidTradesCount: 0,
          duplicateCount: 0,
          globalErrors: [parseResult.error || 'Invalid JSON input'],
          trades: [],
        },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 3. Fetch household context (active portfolio persons)
    const { data: personsData, error: personsError } = await supabase
      .from('persons')
      .select('id, household_id, display_name, relationship_label, is_active')
      .eq('household_id', ctx.householdId)
      .eq('is_active', true);

    if (personsError) {
      console.error('Failed to fetch household persons:', personsError);
      return NextResponse.json(
        { error: 'Failed to fetch household portfolio persons' },
        { status: 500 }
      );
    }

    const persons: PersonContext[] = personsData || [];

    // 4. Fetch active brokers
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

    // 5. Fetch existing open trades for duplicate warning checks
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

    // 6. Execute full domain validation and preview generation
    const validationResult = validateTradesPayload({
      rawTrades: parseResult.rawTrades!,
      schemaVersion: parseResult.schemaVersion,
      householdId: ctx.householdId,
      userRole: ctx.role,
      persons,
      brokers,
      existingOpenTrades,
    });

    return NextResponse.json(validationResult);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AuthError') {
      const statusCode = 'statusCode' in error ? (error as { statusCode: number }).statusCode : 403;
      return NextResponse.json({ error: error.message }, { status: statusCode });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('POST /api/trades/import/validate error:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
