/**
 * GET /api/capital/summary
 * Returns the full capital and profit summary for the authenticated user's household.
 * Accessible by ADMIN and VIEWER.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHouseholdMember, withAuthError } from '@/lib/auth/server-auth';
import { getHouseholdCapitalSummary } from '@/lib/services/capital-service';

export const dynamic = 'force-dynamic';

export const GET = withAuthError(async (_req: NextRequest) => {
  const ctx = await requireHouseholdMember();

  const summary = await getHouseholdCapitalSummary(ctx.householdId);

  return NextResponse.json(
    { summary },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    }
  );
});
