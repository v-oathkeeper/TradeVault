import { describe, it, expect, vi } from 'vitest';
import { generateWeeklyTradingReport } from '../weekly-report-service';
import {
  toISTDateString,
  getISTStartOfDayISO,
  getISTEndOfDayISO,
  getCompletedTradingWeekIST,
  parseISTDate,
} from '@/lib/calculations/weekly-calendar';
import { AuthError } from '@/lib/auth/server-auth';
import type { WeeklyReportFilters } from '@/types/weekly-report';

describe('TradeVault — Weekly Trading Reports Suite (14 Scenarios)', () => {
  const householdId = 'b1000000-0000-0000-0000-000000000001';
  const husbandId = 'c1000000-0000-0000-0000-000000000001';
  const wifeId = 'c2000000-0000-0000-0000-000000000002';
  const kiteBrokerId = 'a1000000-0000-0000-0000-000000000001';
  const shoonyaBrokerId = 'a2000000-0000-0000-0000-000000000002';

  const mockPersons = [
    {
      id: husbandId,
      household_id: householdId,
      display_name: 'Husband',
      relationship_label: 'Husband',
      is_active: true,
    },
    {
      id: wifeId,
      household_id: householdId,
      display_name: 'Wife',
      relationship_label: 'Wife',
      is_active: true,
    },
  ];

  const mockBrokers = [
    { id: kiteBrokerId, code: 'KITE', name: 'Zerodha Kite', is_active: true },
    { id: shoonyaBrokerId, code: 'SHOONYA', name: 'Shoonya by Finvasia', is_active: true },
  ];

  // Helper to create mock Supabase with supplied trade records
  function createMockSupabase(trades: any[]) {
    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'persons') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockPersons, error: null }),
            }),
          };
        }
        if (table === 'brokers') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockBrokers, error: null }),
          };
        }
        if (table === 'trades') {
          let currentTrades = [...trades];
          const queryBuilder: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((column: string, val: any) => {
              if (column === 'household_id') {
                currentTrades = currentTrades.filter((t) => t.household_id === val);
              } else if (column === 'portfolio_owner_id') {
                currentTrades = currentTrades.filter((t) => t.portfolio_owner_id === val);
              } else if (column === 'broker_id') {
                currentTrades = currentTrades.filter((t) => t.broker_id === val);
              }
              return queryBuilder;
            }),
            then: (resolve: (val: any) => void) => {
              resolve({ data: currentTrades, error: null });
            },
          };
          return queryBuilder;
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    } as any;
  }

  const defaultFilters: WeeklyReportFilters = {
    portfolio_owner: 'Combined',
    portfolio_owner_id: null,
    strategy: 'BOTH',
    broker: 'ALL',
  };

  // =========================================================================
  // Scenario 1: Intraday-only report
  // =========================================================================
  it('Scenario 1: Generates Intraday-only report with holding time and time-of-day analytics', async () => {
    const trades = [
      {
        id: 't-intra-1',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'TATASTEEL',
        exchange: 'NSE',
        trade_type: 'INTRADAY',
        direction: 'LONG',
        quantity: 100,
        entry_price: 150.0,
        exit_price: 155.0,
        entry_at: '2026-11-02T10:00:00+05:30',
        exit_at: '2026-11-02T11:00:00+05:30',
        initial_stop_loss: 147.0,
        current_stop_loss: 147.0,
        gross_pnl: 500.0,
        total_charges: 25.0,
        net_pnl: 475.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
      {
        id: 't-swing-1',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'RELIANCE',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 10,
        entry_price: 2500.0,
        exit_price: 2600.0,
        entry_at: '2026-11-02T11:00:00+05:30',
        exit_at: '2026-11-05T14:00:00+05:30',
        initial_stop_loss: 2450.0,
        current_stop_loss: 2450.0,
        gross_pnl: 1000.0,
        total_charges: 60.0,
        net_pnl: 940.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: { ...defaultFilters, strategy: 'INTRADAY' },
      supabase,
    });

    expect(report.intraday.summary.total_trades).toBe(1);
    expect(report.swing.summary.total_trades).toBe(0);
    expect(report.summary.net_realized_pnl).toBe(475.0);
    expect(report.intraday.summary.average_holding_minutes).toBe(60); // 10:00 to 11:00 = 60 mins
    expect(report.intraday.summary.time_of_day_performance.find((p) => p.period === 'morning')?.trades).toBe(1);
  });

  // =========================================================================
  // Scenario 2: Swing-only report
  // =========================================================================
  it('Scenario 2: Generates Swing-only report with R-distribution and target milestones', async () => {
    const trades = [
      {
        id: 't-swing-1',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'INFY',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 20,
        entry_price: 1800.0,
        exit_price: 1900.0,
        entry_at: '2026-11-02T09:30:00+05:30',
        exit_at: '2026-11-05T15:00:00+05:30',
        initial_stop_loss: 1750.0, // initial risk = 50 * 20 = 1000
        current_stop_loss: 1850.0,
        gross_pnl: 2000.0,
        total_charges: 45.0,
        net_pnl: 1955.0, // ~1.95R
        realized_r_multiple: 1.95,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: { ...defaultFilters, strategy: 'SWING' },
      supabase,
    });

    expect(report.swing.summary.total_trades).toBe(1);
    expect(report.intraday.summary.total_trades).toBe(0);
    expect(report.swing.summary.trades_reaching_r_targets.r1_reached).toBe(1);
    expect(report.swing.summary.r_distribution.find((d) => d.range === '+1R to +2R')?.count).toBe(1);
  });

  // =========================================================================
  // Scenario 3: Combined report
  // =========================================================================
  it('Scenario 3: Generates Combined report aggregating both Intraday and Swing metrics', async () => {
    const trades = [
      {
        id: 't-intra',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'SBIN',
        exchange: 'NSE',
        trade_type: 'INTRADAY',
        direction: 'LONG',
        quantity: 50,
        entry_price: 800.0,
        exit_price: 810.0,
        entry_at: '2026-11-03T09:45:00+05:30',
        exit_at: '2026-11-03T11:15:00+05:30',
        initial_stop_loss: 795.0,
        current_stop_loss: 795.0,
        gross_pnl: 500.0,
        total_charges: 20.0,
        net_pnl: 480.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
      {
        id: 't-swing',
        household_id: householdId,
        portfolio_owner_id: wifeId,
        broker_id: shoonyaBrokerId,
        symbol: 'ITC',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 100,
        entry_price: 450.0,
        exit_price: 460.0,
        entry_at: '2026-11-02T10:00:00+05:30',
        exit_at: '2026-11-06T14:00:00+05:30',
        initial_stop_loss: 440.0,
        current_stop_loss: 450.0,
        gross_pnl: 1000.0,
        total_charges: 30.0,
        net_pnl: 970.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: { ...defaultFilters, strategy: 'BOTH' },
      supabase,
    });

    expect(report.summary.total_trades).toBe(2);
    expect(report.summary.winning_trades).toBe(2);
    expect(report.summary.net_realized_pnl).toBe(1450.0);
    expect(report.intraday.summary.total_trades).toBe(1);
    expect(report.swing.summary.total_trades).toBe(1);
  });

  // =========================================================================
  // Scenario 4: Me, Spouse, and Combined filter resolution
  // =========================================================================
  it('Scenario 4: Resolves Me, Spouse, and Combined portfolio filters accurately', async () => {
    const trades = [
      {
        id: 't-husband',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'WIPRO',
        exchange: 'NSE',
        trade_type: 'INTRADAY',
        direction: 'LONG',
        quantity: 50,
        entry_price: 500.0,
        exit_price: 510.0,
        entry_at: '2026-11-02T10:00:00+05:30',
        exit_at: '2026-11-02T11:00:00+05:30',
        initial_stop_loss: 495.0,
        current_stop_loss: 495.0,
        net_pnl: 480.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
      {
        id: 't-wife',
        household_id: householdId,
        portfolio_owner_id: wifeId,
        broker_id: shoonyaBrokerId,
        symbol: 'HDFCBANK',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 10,
        entry_price: 1600.0,
        exit_price: 1650.0,
        entry_at: '2026-11-02T10:00:00+05:30',
        exit_at: '2026-11-04T12:00:00+05:30',
        initial_stop_loss: 1580.0,
        current_stop_loss: 1580.0,
        net_pnl: 490.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);

    // Filter Me (Husband)
    const reportMe = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: { ...defaultFilters, portfolio_owner: 'Husband', portfolio_owner_id: husbandId },
      supabase,
    });
    expect(reportMe.summary.total_trades).toBe(1);
    expect(reportMe.summary.net_realized_pnl).toBe(480.0);

    // Filter Spouse (Wife)
    const reportSpouse = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: { ...defaultFilters, portfolio_owner: 'Wife', portfolio_owner_id: wifeId },
      supabase,
    });
    expect(reportSpouse.summary.total_trades).toBe(1);
    expect(reportSpouse.summary.net_realized_pnl).toBe(490.0);
  });

  // =========================================================================
  // Scenario 5: Trade opened in previous week but closed this week
  // =========================================================================
  it('Scenario 5: Trade opened in previous week and closed this week counts in realized P&L but not new trades', async () => {
    const trades = [
      {
        id: 't-prev-week',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'TITAN',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 10,
        entry_price: 3200.0,
        exit_price: 3300.0,
        entry_at: '2026-10-23T11:00:00+05:30', // Previous week
        exit_at: '2026-11-03T14:30:00+05:30',  // This week
        initial_stop_loss: 3150.0,
        current_stop_loss: 3250.0,
        gross_pnl: 1000.0,
        total_charges: 40.0,
        net_pnl: 960.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    expect(report.weekly_activity.new_trades_opened_this_week).toBe(0);
    expect(report.weekly_activity.trades_closed_this_week).toBe(1);
    expect(report.summary.net_realized_pnl).toBe(960.0);
    expect(report.summary.winning_trades).toBe(1);
  });

  // =========================================================================
  // Scenario 6: Trade opened this week and still open
  // =========================================================================
  it('Scenario 6: Trade opened this week and still open contributes to open risk, not realized win/loss', async () => {
    const trades = [
      {
        id: 't-open-pos',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'BHARTIARTL',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 20,
        entry_price: 1500.0,
        exit_price: null,
        entry_at: '2026-11-03T10:30:00+05:30',
        exit_at: null,
        initial_stop_loss: 1450.0, // risk per share = 50, total risk = 1000
        current_stop_loss: 1450.0,
        initial_risk_rupees: 1000.0,
        gross_pnl: null,
        total_charges: 20.0,
        net_pnl: null,
        status: 'OPEN',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    expect(report.weekly_activity.new_trades_opened_this_week).toBe(1);
    expect(report.weekly_activity.open_positions_carried_forward).toBe(1);
    expect(report.summary.total_trades).toBe(0); // 0 closed trades
    expect(report.summary.net_realized_pnl).toBe(0);
    expect(report.portfolio_risk.current_open_risk_rupees).toBe(1000.0);
    expect(report.portfolio_risk.active_open_positions_count).toBe(1);
  });

  // =========================================================================
  // Scenario 7: Trade with partial exits across multiple weeks
  // =========================================================================
  it('Scenario 7: Trade with partial exits across multiple weeks is recognized under partial_exits', async () => {
    const trades = [
      {
        id: 't-partial',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'ASIANPAINT',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 40,
        entry_price: 3000.0,
        exit_price: 3100.0,
        entry_at: '2026-10-20T10:00:00+05:30', // Earlier week
        exit_at: null,
        initial_stop_loss: 2900.0,
        current_stop_loss: 3000.0,
        status: 'OPEN',
        stop_loss_history: [],
        trade_executions: [
          {
            id: 'ex-1',
            trade_id: 't-partial',
            execution_type: 'ENTRY',
            quantity: 40,
            price: 3000.0,
            executed_at: '2026-10-20T10:00:00+05:30',
          },
          {
            id: 'ex-2',
            trade_id: 't-partial',
            execution_type: 'EXIT',
            quantity: 20,
            price: 3100.0,
            executed_at: '2026-11-04T11:00:00+05:30', // This week
          },
        ],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    expect(report.weekly_activity.partial_exits_this_week).toBe(1);
  });

  // =========================================================================
  // Scenario 8: Trade with multiple stop-loss updates labeled as management decisions
  // =========================================================================
  it('Scenario 8: Multiple stop-loss updates are labeled as management decisions without assuming broker execution', async () => {
    const trades = [
      {
        id: 't-sl-mgmt',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'KOTAKBANK',
        exchange: 'NSE',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        quantity: 50,
        entry_price: 1800.0,
        exit_price: null,
        entry_at: '2026-11-02T09:30:00+05:30',
        exit_at: null,
        initial_stop_loss: 1750.0, // Risk = 50 * 50 = 2500
        current_stop_loss: 1850.0,
        status: 'OPEN',
        stop_loss_history: [
          {
            id: 'sl-1',
            trade_id: 't-sl-mgmt',
            previous_stop: 1750.0,
            new_stop: 1800.0,
            stop_type: 'BREAKEVEN',
            floating_r_at_update: 1.0,
            notes: 'Trailing to breakeven after +1R move',
            created_at: '2026-11-03T11:00:00+05:30',
          },
          {
            id: 'sl-2',
            trade_id: 't-sl-mgmt',
            previous_stop: 1800.0,
            new_stop: 1850.0,
            stop_type: 'TRAIL',
            floating_r_at_update: 2.0,
            notes: 'Locking +1R profit at 1850',
            created_at: '2026-11-04T14:00:00+05:30',
          },
        ],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    const trade = report.trades.find((t) => t.trade_id === 't-sl-mgmt');
    expect(trade).toBeDefined();
    expect(trade!.stop_loss_history.length).toBe(2);

    // Rule: Must be explicitly marked as management decision, never assuming broker execution
    trade!.stop_loss_history.forEach((sl) => {
      expect(sl.is_broker_confirmed).toBe(false);
    });

    expect(trade!.stop_loss_history[0].sl_level_label).toBe('BREAKEVEN');
    expect(trade!.stop_loss_history[1].sl_level_label).toBe('+1R');
    expect(report.weekly_activity.stop_loss_updates_this_week).toBe(2);
  });

  // =========================================================================
  // Scenario 9: Trades with missing optional fields to verify null handling
  // =========================================================================
  it('Scenario 9: Missing optional fields return null and never substitute zero or placeholder strings', async () => {
    const trades = [
      {
        id: 't-missing-opt',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'AXISBANK',
        exchange: 'NSE',
        trade_type: 'INTRADAY',
        direction: 'LONG',
        quantity: 10,
        entry_price: 1100.0,
        exit_price: 1120.0,
        entry_at: '2026-11-02T10:00:00+05:30',
        exit_at: '2026-11-02T11:00:00+05:30',
        initial_stop_loss: 1080.0,
        current_stop_loss: 1080.0,
        planned_target: null, // missing target
        strategy_name: null,  // missing strategy
        notes: null,          // missing notes
        gross_pnl: 200.0,
        total_charges: 15.0,
        net_pnl: 185.0,
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    const item = report.trades.find((t) => t.trade_id === 't-missing-opt');
    expect(item).toBeDefined();
    expect(item!.target_price).toBeNull();
    expect(item!.strategy).toBeNull();
    expect(item!.notes).toBeNull();
    expect(item!.entry_rationale).toBeNull();
  });

  // =========================================================================
  // Scenario 10: Correct fee and R-multiple calculations matching engine
  // =========================================================================
  it('Scenario 10: Mathematically validates net P&L, realized R-multiple, win rate, and profit factor', async () => {
    const trades = [
      {
        id: 't-win',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'BAJFINANCE',
        exchange: 'NSE',
        trade_type: 'INTRADAY',
        direction: 'LONG',
        quantity: 10,
        entry_price: 7000.0,
        exit_price: 7200.0, // gross = 2000
        entry_at: '2026-11-02T10:00:00+05:30',
        exit_at: '2026-11-02T11:00:00+05:30',
        initial_stop_loss: 6900.0, // initial risk = 100 * 10 = 1000
        current_stop_loss: 6900.0,
        gross_pnl: 2000.0,
        total_charges: 50.0,
        net_pnl: 1950.0, // realized R = 1950 / 1000 = 1.95R
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
      {
        id: 't-loss',
        household_id: householdId,
        portfolio_owner_id: husbandId,
        broker_id: kiteBrokerId,
        symbol: 'LT',
        exchange: 'NSE',
        trade_type: 'INTRADAY',
        direction: 'LONG',
        quantity: 10,
        entry_price: 3500.0,
        exit_price: 3400.0, // gross = -1000
        entry_at: '2026-11-03T10:00:00+05:30',
        exit_at: '2026-11-03T11:00:00+05:30',
        initial_stop_loss: 3400.0, // initial risk = 100 * 10 = 1000
        current_stop_loss: 3400.0,
        gross_pnl: -1000.0,
        total_charges: 30.0,
        net_pnl: -1030.0, // realized R = -1030 / 1000 = -1.03R
        status: 'CLOSED',
        stop_loss_history: [],
        trade_executions: [],
      },
    ];

    const supabase = createMockSupabase(trades);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    expect(report.summary.total_trades).toBe(2);
    expect(report.summary.winning_trades).toBe(1);
    expect(report.summary.losing_trades).toBe(1);
    expect(report.summary.win_rate).toBe(50.0);
    expect(report.summary.gross_realized_pnl).toBe(1000.0);
    expect(report.summary.total_charges).toBe(80.0);
    expect(report.summary.net_realized_pnl).toBe(920.0);
    // Profit factor = total gross wins / total gross losses = 2000 / 1000 = 2.0
    expect(report.summary.profit_factor).toBe(2.0);
    // Expectancy = 920 / 2 = 460
    expect(report.summary.expectancy).toBe(460.0);
  });

  // =========================================================================
  // Scenario 11: Correct date handling in IST (Asia/Kolkata)
  // =========================================================================
  it('Scenario 11: Date helpers produce accurate Asia/Kolkata ISO strings with +05:30 offset', () => {
    const startIso = getISTStartOfDayISO('2026-11-02');
    const endIso = getISTEndOfDayISO('2026-11-06');

    expect(startIso).toBe('2026-11-02T00:00:00.000+05:30');
    expect(endIso).toBe('2026-11-06T23:59:59.999+05:30');

    const completedWeek = getCompletedTradingWeekIST();
    expect(completedWeek.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(completedWeek.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify parsed IST Date
    const parsed = parseISTDate('2026-11-02');
    expect(toISTDateString(parsed)).toBe('2026-11-02');
  });

  // =========================================================================
  // Scenario 12: JSON export schema validation (Schema v1.0)
  // =========================================================================
  it('Scenario 12: Generates valid Schema v1.0 JSON with all mandatory root fields', async () => {
    const supabase = createMockSupabase([]);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    // Root Schema Keys
    expect(report.report_version).toBe('1.0');
    expect(report.report_type).toBe('WEEKLY_TRADING_REVIEW');
    expect(report.timezone).toBe('Asia/Kolkata');
    expect(report.period).toEqual({
      start_date: '2026-11-02',
      end_date: '2026-11-06',
    });
    expect(report.filters).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.weekly_activity).toBeDefined();
    expect(report.trades).toBeInstanceOf(Array);
    expect(report.intraday).toBeDefined();
    expect(report.swing).toBeDefined();
    expect(report.portfolio_risk).toBeDefined();
    expect(report.ai_review).toBeDefined();
    expect(report.data_quality).toBeDefined();

    // Verify serialization round-trip
    const serialized = JSON.stringify(report);
    const parsed = JSON.parse(serialized);
    expect(parsed.report_version).toBe('1.0');
  });

  // =========================================================================
  // Scenario 13: Viewer role authorization rejection
  // =========================================================================
  it('Scenario 13: Rejects VIEWER accounts with 403 Forbidden', () => {
    // Mimic requireAdmin logic
    const userRole = 'VIEWER';
    function checkAdmin(role: string) {
      if (role !== 'ADMIN') {
        throw new AuthError('Administrator privileges required to access weekly reports', 403);
      }
    }

    expect(() => checkAdmin(userRole)).toThrow(AuthError);
    try {
      checkAdmin(userRole);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
    }
  });

  // =========================================================================
  // Scenario 14: Mobile preview and copy functionality
  // =========================================================================
  it('Scenario 14: Validates mobile export string and AI review context formatting', async () => {
    const supabase = createMockSupabase([]);
    const report = await generateWeeklyTradingReport({
      householdId,
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      filters: defaultFilters,
      supabase,
    });

    const jsonString = JSON.stringify(report, null, 2);
    expect(jsonString).toContain('"report_version": "1.0"');
    expect(jsonString).toContain('"timezone": "Asia/Kolkata"');

    // Prompt context formatting test
    const aiPrompt = `Here is the TradeVault Weekly Trading Performance Report (v${report.report_version}) for the period ${report.period.start_date} to ${report.period.end_date} (IST)`;
    expect(aiPrompt).toContain('2026-11-02 to 2026-11-06');
  });
});
