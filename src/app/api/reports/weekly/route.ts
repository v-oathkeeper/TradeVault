import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCompletedTradingWeekIST } from '@/lib/calculations/weekly-calendar';
import { generateWeeklyTradingReport } from '@/lib/services/weekly-report-service';
import type { WeeklyReportFilters } from '@/types/weekly-report';

export async function GET(request: NextRequest) {
  try {
    // 1. Strict Server-Side Authorization: Admin only
    const ctx = await requireAdmin();

    const searchParams = request.nextUrl.searchParams;
    const defaultWeek = getCompletedTradingWeekIST();

    const startDate = searchParams.get('startDate') || defaultWeek.startDate;
    const endDate = searchParams.get('endDate') || defaultWeek.endDate;
    const portfolioOwnerParam = (searchParams.get('portfolioOwner') || 'all').trim();
    const strategyParam = (searchParams.get('strategy') || 'ALL').toUpperCase();
    const brokerParam = (searchParams.get('broker') || 'ALL').toUpperCase();
    const format = searchParams.get('format') || 'data';

    // Validate strategy
    let strategy: 'BOTH' | 'INTRADAY' | 'SWING' = 'BOTH';
    if (strategyParam === 'INTRADAY') strategy = 'INTRADAY';
    else if (strategyParam === 'SWING') strategy = 'SWING';
    else strategy = 'BOTH';

    // Validate broker
    const validBrokers = ['ALL', 'ZERODHA', 'SHOONYA'] as const;
    const broker = validBrokers.includes(brokerParam as any)
      ? (brokerParam as 'ALL' | 'ZERODHA' | 'SHOONYA')
      : 'ALL';

    const supabase = await createSupabaseServerClient();

    // Fetch household persons
    const { data: persons, error: personsError } = await supabase
      .from('persons')
      .select('id, display_name, relationship_label, is_active')
      .eq('household_id', ctx.householdId);

    if (personsError) {
      return NextResponse.json(
        { error: 'Failed to fetch household portfolio members' },
        { status: 500 }
      );
    }

    const activePersons = persons || [];

    // Resolve portfolio owner filter
    let targetOwnerId = 'all';
    let targetOwnerLabel = 'Combined';

    if (portfolioOwnerParam.toLowerCase() === 'me') {
      const mePerson = activePersons.find(
        (p) =>
          p.relationship_label?.toLowerCase().includes('husband') ||
          p.display_name?.toLowerCase().includes('husband') ||
          p.relationship_label?.toLowerCase().includes('self')
      );
      if (mePerson) {
        targetOwnerId = mePerson.id;
        targetOwnerLabel = mePerson.display_name || 'Me';
      }
    } else if (portfolioOwnerParam.toLowerCase() === 'spouse') {
      const spousePerson = activePersons.find(
        (p) =>
          p.relationship_label?.toLowerCase().includes('wife') ||
          p.display_name?.toLowerCase().includes('wife') ||
          p.relationship_label?.toLowerCase().includes('spouse')
      );
      if (spousePerson) {
        targetOwnerId = spousePerson.id;
        targetOwnerLabel = spousePerson.display_name || 'Spouse';
      }
    } else if (portfolioOwnerParam !== 'all') {
      const match = activePersons.find((p) => p.id === portfolioOwnerParam);
      if (match) {
        targetOwnerId = match.id;
        targetOwnerLabel = match.display_name;
      }
    }

    const filters: WeeklyReportFilters = {
      portfolio_owner: targetOwnerLabel,
      portfolio_owner_id: targetOwnerId === 'all' ? null : targetOwnerId,
      strategy,
      broker,
    };

    const report = await generateWeeklyTradingReport({
      householdId: ctx.householdId,
      startDate,
      endDate,
      filters,
      supabase,
    });

    if (format === 'json') {
      const jsonStr = JSON.stringify(report, null, 2);
      return new NextResponse(jsonStr, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="tradevault-weekly-report-${startDate}.json"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
