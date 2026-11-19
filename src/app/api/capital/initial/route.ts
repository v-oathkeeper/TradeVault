/**
 * POST /api/capital/initial
 * Sets or updates the initial invested capital for an account owner (Husband or Wife).
 * ADMIN only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, withAuthError } from '@/lib/auth/server-auth';
import { setInitialCapital } from '@/lib/services/capital-service';

export const POST = withAuthError(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }
  const allocations = Array.isArray(body.allocations) ? body.allocations : [body];

  if (
    allocations.length === 0 ||
    allocations.length > 20 ||
    allocations.some(
      (item: any) =>
        typeof item?.portfolioOwnerId !== 'string' ||
        !item.portfolioOwnerId ||
        typeof item.amount !== 'number' ||
        !Number.isFinite(item.amount) ||
        item.amount < 0 ||
        (item.notes != null && typeof item.notes !== 'string')
    )
  ) {
    return NextResponse.json(
      { error: 'Each allocation needs an owner and a finite non-negative amount' },
      { status: 400 }
    );
  }

  const ownerIds = allocations.map((item: { portfolioOwnerId: string }) => item.portfolioOwnerId);
  if (new Set(ownerIds).size !== ownerIds.length) {
    return NextResponse.json({ error: 'Each owner can only be included once' }, { status: 400 });
  }

  // Validate all owners in one query before writing any allocations.
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const supabase = await createSupabaseServerClient();
  const { data: people, error: peopleError } = await supabase
    .from('persons')
    .select('id')
    .eq('household_id', ctx.householdId)
    .eq('is_active', true)
    .in('id', ownerIds);

  if (peopleError) {
    return NextResponse.json({ error: 'Unable to verify portfolio owners' }, { status: 503 });
  }
  if ((people ?? []).length !== ownerIds.length) {
    return NextResponse.json(
      { error: 'One or more portfolio owners are invalid for this household' },
      { status: 403 }
    );
  }

  try {
    const transactions = await Promise.all(
      allocations.map((item: { portfolioOwnerId: string; amount: number; notes?: string }) =>
        setInitialCapital(ctx.householdId, ctx.user.id, item.portfolioOwnerId, item.amount, item.notes)
      )
    );
    return NextResponse.json({ transactions }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set initial capital';
    return NextResponse.json({ error: message }, { status: 422 });
  }
});
