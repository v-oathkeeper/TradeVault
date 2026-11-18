/**
 * POST /api/trades/milestones/preview
 *
 * Validates Gemini JSON input and returns a preview of parsed milestones
 * and matching trade without saving anything.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHouseholdMember, withAuthError } from '@/lib/auth/server-auth';
import { previewGeminiMilestones } from '@/lib/services/gemini-milestone-service';

export const POST = withAuthError(async (req: NextRequest) => {
  const ctx = await requireHouseholdMember();
  const body = await req.json();

  const { jsonText, tradeId } = body;

  if (!jsonText || typeof jsonText !== 'string') {
    return NextResponse.json(
      { error: 'Missing jsonText string in request body' },
      { status: 400 }
    );
  }

  const result = await previewGeminiMilestones(ctx.householdId, jsonText, tradeId);

  return NextResponse.json(result);
});
