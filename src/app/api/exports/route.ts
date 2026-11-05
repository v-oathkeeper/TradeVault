import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/server-auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAdmin();
    const { searchParams } = request.nextUrl;

    const format = searchParams.get('format') ?? 'csv'; // csv | xlsx | json
    const personId = searchParams.get('personId');
    const status = searchParams.get('status');

    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from('trades')
      .select(`
        *,
        portfolio_owner:persons(id, display_name, relationship_label),
        broker:brokers(id, code, name)
      `)
      .eq('household_id', ctx.householdId)
      .order('entry_at', { ascending: false });

    if (personId && personId !== 'all') {
      query = query.eq('portfolio_owner_id', personId);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status as any);
    }

    const { data: trades, error } = await query;

    if (error || !trades) {
      return NextResponse.json({ error: 'Failed to fetch trades for export' }, { status: 500 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. JSON Export
    if (format === 'json') {
      return new NextResponse(JSON.stringify(trades, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="tradevault-export-${todayStr}.json"`,
        },
      });
    }

    // 2. CSV Export
    if (format === 'csv') {
      const headers = [
        'Trade ID',
        'Date',
        'Owner',
        'Broker',
        'Symbol',
        'Exchange',
        'Product',
        'Direction',
        'Quantity',
        'Entry Price',
        'Exit Price',
        'Gross PnL',
        'Brokerage',
        'STT',
        'Exchange Txn',
        'GST',
        'SEBI',
        'Stamp Duty',
        'DP Charges',
        'Total Charges',
        'Net PnL',
        'Status',
        'Notes',
      ];

      const rows = trades.map((t) => {
        const bd = (t.charges_breakdown as any) || {};
        return [
          t.id,
          t.entry_at,
          t.portfolio_owner?.display_name ?? '',
          t.broker?.code ?? '',
          t.symbol,
          t.exchange,
          t.trade_type,
          t.direction,
          t.quantity,
          t.entry_price,
          t.exit_price ?? '',
          t.gross_pnl ?? '',
          bd.brokerage ?? 0,
          bd.stt ?? 0,
          bd.exchangeCharges ?? 0,
          bd.gst ?? 0,
          bd.sebiCharges ?? 0,
          bd.stampDuty ?? 0,
          bd.dpCharges ?? 0,
          t.total_charges ?? 0,
          t.net_pnl ?? '',
          t.status,
          `"${(t.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tradevault-trades-${todayStr}.csv"`,
        },
      });
    }

    // 3. XLSX Export with ExcelJS
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'TradeVault';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Trades Journal', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });

      sheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Portfolio Owner', key: 'owner', width: 16 },
        { header: 'Broker', key: 'broker', width: 12 },
        { header: 'Symbol', key: 'symbol', width: 14 },
        { header: 'Exchange', key: 'exchange', width: 10 },
        { header: 'Product', key: 'product', width: 12 },
        { header: 'Direction', key: 'direction', width: 10 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Entry Price', key: 'entryPrice', width: 14 },
        { header: 'Exit Price', key: 'exitPrice', width: 14 },
        { header: 'Gross P&L', key: 'grossPnl', width: 14 },
        { header: 'Total Charges', key: 'charges', width: 14 },
        { header: 'Net P&L', key: 'netPnl', width: 14 },
        { header: 'Status', key: 'status', width: 12 },
      ];

      // Format header row
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };

      trades.forEach((t) => {
        sheet.addRow({
          date: t.entry_at ? t.entry_at.split('T')[0] : '',
          owner: t.portfolio_owner?.display_name ?? '',
          broker: t.broker?.code ?? '',
          symbol: t.symbol,
          exchange: t.exchange,
          product: t.trade_type,
          direction: t.direction,
          quantity: t.quantity,
          entryPrice: Number(t.entry_price),
          exitPrice: t.exit_price ? Number(t.exit_price) : '',
          grossPnl: t.gross_pnl ? Number(t.gross_pnl) : '',
          charges: Number(t.total_charges ?? 0),
          netPnl: t.net_pnl ? Number(t.net_pnl) : '',
          status: t.status,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="tradevault-journal-${todayStr}.xlsx"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
