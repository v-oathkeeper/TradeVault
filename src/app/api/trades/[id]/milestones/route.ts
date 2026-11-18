/**
 * POST /api/trades/[id]/milestones
 * Applies Gemini milestone updates to a trade. ADMIN only.
 *
 * GET /api/trades/[id]/milestones
 * Retrieves milestone update history for this trade.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireHouseholdMember, withAuthError } from '@/lib/auth/server-auth';
import {
  applyGeminiMilestones,
  getTradeMilestoneHistory,
} from '@/lib/services/gemini-milestone-service';
import { parseAndValidateGeminiJson } from '@/lib/validation/gemini-schema';

export const GET = withAuthError(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireHouseholdMember();
    const { id } = await params;

    const history = await getTradeMilestoneHistory(id);
    return NextResponse.json({ history });
  }
);

export const POST = withAuthError(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireAdmin();
    const { id } = await params;

    const body = await req.json();

    let milestonesData = body.milestones;
    if (!milestonesData && body.jsonText) {
      const parsed = parseAndValidateGeminiJson(body.jsonText);
      if (!parsed.success || !parsed.data) {
        return NextResponse.json(
          { error: parsed.error ?? 'Invalid Gemini milestone JSON' },
          { status: 400 }
        );
      }
      milestonesData = parsed.data;
    }

    if (!milestonesData) {
      return NextResponse.json(
        { error: 'Missing milestones data or jsonText in request body' },
        { status: 400 }
      );
    }

    const result = await applyGeminiMilestones(
      ctx.householdId,
      ctx.user.id,
      id,
      milestonesData,
      body.rawJson ?? body.jsonText
    );

    return NextResponse.json(result, { status: 200 });
  }
);
