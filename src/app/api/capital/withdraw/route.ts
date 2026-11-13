/**
 * POST /api/capital/withdraw
 * Records a profit or capital withdrawal. ADMIN only.
 *
 * Body:
 *   portfolioOwnerId  - person ID
 *   strategyBucket    - 'INTRADAY' | 'SWING'
 *   withdrawalType    - 'PROFIT' | 'CAPITAL'
 *   amount            - positive number
 *   txDate            - ISO date string (YYYY-MM-DD)
 *   notes?            - optional
 *   idempotencyKey?   - optional dedup key
 *   overrideCapitalLimit? - boolean, requires overrideReason
 *   overrideReason?   - required when overrideCapitalLimit=true
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, withAuthError } from '@/lib/auth/server-auth';
import { recordWithdrawal } from '@/lib/services/capital-service';
import type { RecordWithdrawalInput, StrategyBucket } from '@/types/capital';

export const POST = withAuthError(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  const body = await req.json();
  const {
    portfolioOwnerId,
    strategyBucket,
    withdrawalType,
    amount,
    txDate,
    notes,
    idempotencyKey,
    overrideCapitalLimit,
    overrideReason,
  } = body;

  // Validate required fields
  if (!portfolioOwnerId || !strategyBucket || !withdrawalType || !amount || !txDate) {
    return NextResponse.json(
      { error: 'Missing required fields: portfolioOwnerId, strategyBucket, withdrawalType, amount, txDate' },
      { status: 400 }
    );
  }

  if (!['INTRADAY', 'SWING'].includes(strategyBucket)) {
    return NextResponse.json({ error: 'strategyBucket must be INTRADAY or SWING' }, { status: 400 });
  }

  if (!['PROFIT', 'CAPITAL'].includes(withdrawalType)) {
    return NextResponse.json({ error: 'withdrawalType must be PROFIT or CAPITAL' }, { status: 400 });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  if (overrideCapitalLimit && !overrideReason) {
    return NextResponse.json(
      { error: 'overrideReason is required when overrideCapitalLimit is true' },
      { status: 400 }
    );
  }

  // Server-side verify owner belongs to household (never trust client)
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from('persons')
    .select('id')
    .eq('id', portfolioOwnerId)
    .eq('household_id', ctx.householdId)
    .eq('is_active', true)
    .maybeSingle();

  if (!person) {
    return NextResponse.json({ error: 'Invalid portfolioOwnerId for this household' }, { status: 403 });
  }

  const input: RecordWithdrawalInput = {
    portfolioOwnerId,
    strategyBucket: strategyBucket as StrategyBucket,
    withdrawalType,
    amount,
    txDate,
    notes: notes ?? undefined,
    idempotencyKey: idempotencyKey ?? undefined,
    overrideCapitalLimit: overrideCapitalLimit ?? false,
    overrideReason: overrideReason ?? undefined,
  };

  try {
    const tx = await recordWithdrawal(ctx.householdId, ctx.user.id, input);
    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record withdrawal';
    return NextResponse.json({ error: message }, { status: 422 });
  }
});
