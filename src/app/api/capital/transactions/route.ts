/**
 * GET /api/capital/transactions
 * Returns capital transaction history. Accessible by ADMIN and VIEWER.
 *
 * Query params:
 *   portfolioOwnerId? - filter by owner
 *   strategyBucket?   - 'INTRADAY' | 'SWING'
 *   limit?            - default 50
 *   offset?           - default 0
 *
 * POST /api/capital/transactions
 * Creates a new capital transaction (INITIAL_ALLOCATION, CAPITAL_CONTRIBUTION, CAPITAL_ADJUSTMENT).
 * ADMIN only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireHouseholdMember, requireAdmin, withAuthError } from '@/lib/auth/server-auth';
import {
  getCapitalTransactions,
  createCapitalTransaction,
} from '@/lib/services/capital-service';
import type { StrategyBucket, CreateCapitalTransactionInput } from '@/types/capital';

export const GET = withAuthError(async (req: NextRequest) => {
  const ctx = await requireHouseholdMember();
  const { searchParams } = new URL(req.url);

  const portfolioOwnerId = searchParams.get('portfolioOwnerId') ?? undefined;
  const strategyBucket = (searchParams.get('strategyBucket') as StrategyBucket) ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const result = await getCapitalTransactions(ctx.householdId, {
    portfolioOwnerId,
    strategyBucket,
    limit,
    offset,
  });

  return NextResponse.json(result);
});

export const POST = withAuthError(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  const body = await req.json();
  const {
    portfolioOwnerId,
    strategyBucket,
    txType,
    amount,
    txDate,
    notes,
    idempotencyKey,
    previousAmount,
    newAmount,
  } = body;

  // Validate required fields
  if (!portfolioOwnerId || !strategyBucket || !txType || !amount || !txDate) {
    return NextResponse.json(
      { error: 'Missing required fields: portfolioOwnerId, strategyBucket, txType, amount, txDate' },
      { status: 400 }
    );
  }

  // Validate strategy bucket
  if (!['INTRADAY', 'SWING'].includes(strategyBucket)) {
    return NextResponse.json({ error: 'strategyBucket must be INTRADAY or SWING' }, { status: 400 });
  }

  // Only allow capital-side tx types (not withdrawals — those use /api/capital/withdraw)
  const allowedTypes = ['INITIAL_ALLOCATION', 'CAPITAL_CONTRIBUTION', 'CAPITAL_ADJUSTMENT'];
  if (!allowedTypes.includes(txType)) {
    return NextResponse.json(
      { error: 'Use /api/capital/withdraw for CAPITAL_WITHDRAWAL and PROFIT_WITHDRAWAL' },
      { status: 400 }
    );
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  // Verify owner belongs to household
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

  const input: CreateCapitalTransactionInput = {
    portfolioOwnerId,
    strategyBucket: strategyBucket as StrategyBucket,
    txType,
    amount,
    txDate,
    notes: notes ?? undefined,
    idempotencyKey: idempotencyKey ?? undefined,
    previousAmount: previousAmount ?? undefined,
    newAmount: newAmount ?? undefined,
  };

  try {
    const tx = await createCapitalTransaction(ctx.householdId, ctx.user.id, input);
    return NextResponse.json({ transaction: tx }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create transaction';
    return NextResponse.json({ error: message }, { status: 422 });
  }
});
