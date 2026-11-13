/**
 * POST /api/capital/reverse
 * Creates a reversal of an existing capital transaction. ADMIN only.
 * Never deletes original records — appends a reversal entry.
 *
 * Body:
 *   transactionId - UUID of the transaction to reverse
 *   reason        - required explanation
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, withAuthError } from '@/lib/auth/server-auth';
import { reverseCapitalTransaction } from '@/lib/services/capital-service';

export const POST = withAuthError(async (req: NextRequest) => {
  const ctx = await requireAdmin();

  const body = await req.json();
  const { transactionId, reason } = body;

  if (!transactionId || !reason) {
    return NextResponse.json(
      { error: 'transactionId and reason are required' },
      { status: 400 }
    );
  }

  try {
    const reversal = await reverseCapitalTransaction(
      ctx.householdId,
      ctx.user.id,
      transactionId,
      reason
    );
    return NextResponse.json({ reversal }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record reversal';
    return NextResponse.json({ error: message }, { status: 422 });
  }
});
