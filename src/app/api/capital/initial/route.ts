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

  const body = await req.json();
  const { portfolioOwnerId, amount, notes } = body;

  if (!portfolioOwnerId || typeof amount !== 'number' || amount < 0) {
    return NextResponse.json(
      { error: 'portfolioOwnerId and a non-negative amount are required' },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: 'Invalid portfolioOwnerId for this household' },
      { status: 403 }
    );
  }

  try {
    const tx = await setInitialCapital(ctx.householdId, ctx.user.id, portfolioOwnerId, amount, notes);
    return NextResponse.json({ transaction: tx }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to set initial capital';
    return NextResponse.json({ error: message }, { status: 422 });
  }
});
