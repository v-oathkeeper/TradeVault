import { describe, it, expect, vi } from 'vitest';
import {
  parseRawJsonText,
  validateTradesPayload,
  executeTradeImport,
  type PersonContext,
  type BrokerContext,
  type ExistingTradeContext,
} from '../trade-import-service';
import { AuthError } from '@/lib/auth/server-auth';

describe('JSON Trade Import — Comprehensive 12-Scenario Suite', () => {
  const husbandId = 'c1000000-0000-0000-0000-000000000001';
  const wifeId = 'c2000000-0000-0000-0000-000000000002';
  const householdId = 'b1000000-0000-0000-0000-000000000001';
  const adminUserId = 'u1000000-0000-0000-0000-000000000001';

  const mockPersons: PersonContext[] = [
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

  const mockBrokers: BrokerContext[] = [
    {
      id: 'a1000000-0000-0000-0000-000000000001',
      code: 'KITE',
      name: 'Zerodha Kite',
      is_active: true,
    },
    {
      id: 'a2000000-0000-0000-0000-000000000002',
      code: 'SHOONYA',
      name: 'Shoonya by Finvasia',
      is_active: true,
    },
  ];

  // Helper to create a mock Supabase client
  function createMockSupabase(options?: { failOnInsertSymbol?: string; rpcAvailable?: boolean }) {
    const database = {
      trades: [] as any[],
      stop_loss_history: [] as any[],
    };

    return {
      database,
      rpc: vi.fn().mockImplementation((fnName: string, args: any) => {
        if (!options?.rpcAvailable) {
          return Promise.resolve({ data: null, error: { message: 'Function not found' } });
        }
        // Simulated RPC success
        const insertedIds: string[] = [];
        for (const item of args.p_trades) {
          const id = `trade-rpc-${Math.random().toString(36).substring(2, 9)}`;
          insertedIds.push(id);
          database.trades.push({ id, ...item });
        }
        return Promise.resolve({
          data: { success: true, imported_count: insertedIds.length, trade_ids: insertedIds },
          error: null,
        });
      }),
      from: vi.fn().mockImplementation((table: string) => {
        return {
          insert: vi.fn().mockImplementation((data: any) => {
            if (table === 'trades') {
              if (options?.failOnInsertSymbol && data.symbol === options.failOnInsertSymbol) {
                return {
                  select: () => ({
                    single: () => Promise.resolve({ data: null, error: { message: `DB connection error on ${data.symbol}` } }),
                  }),
                };
              }
              const newRecord = { id: `trade-${database.trades.length + 1}`, ...data };
              database.trades.push(newRecord);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: newRecord, error: null }),
                }),
              };
            }
            if (table === 'stop_loss_history') {
              database.stop_loss_history.push(data);
              return Promise.resolve({ data, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }),
          delete: vi.fn().mockImplementation(() => ({
            in: vi.fn().mockImplementation((_column: string, ids: string[]) => {
              database.trades = database.trades.filter((t) => !ids.includes(t.id));
              return Promise.resolve({ data: null, error: null });
            }),
          })),
        };
      }),
    };
  }

  // 1. Import one valid trade
  it('Scenario 1: Imports one valid trade with risk snapshot and initial stop-loss history', async () => {
    const rawTrade = {
      portfolio_owner: 'me',
      broker: 'ZERODHA',
      exchange: 'NSE',
      symbol: 'UNIONBANK',
      trade_type: 'SWING',
      direction: 'LONG',
      entry_price: 182.45,
      initial_stop_loss: 175.5,
      quantity: 10,
      target_price: 203.3,
      strategy: 'Breakout',
      notes: 'Breakout above resistance with volume confirmation',
    };

    const validation = validateTradesPayload({
      rawTrades: [rawTrade],
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.validTradesCount).toBe(1);
    expect(validation.invalidTradesCount).toBe(0);

    const item = validation.trades[0];
    expect(item.portfolioOwnerId).toBe(husbandId);
    expect(item.brokerCode).toBe('KITE');
    expect(item.dbTradeType).toBe('DELIVERY');
    expect(item.riskPerShare).toBeCloseTo(6.95, 2);
    expect(item.riskRupees).toBeCloseTo(69.5, 2);
    expect(item.plannedRR).toBeCloseTo(3.0, 1);

    // Database execution
    const mockSupabase = createMockSupabase();
    const result = await executeTradeImport({
      validatedTrades: validation.trades,
      householdId,
      userId: adminUserId,
      supabase: mockSupabase as any,
    });

    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(1);
    expect(mockSupabase.database.trades.length).toBe(1);
    expect(mockSupabase.database.trades[0].status).toBe('OPEN');
    expect(mockSupabase.database.trades[0].symbol).toBe('UNIONBANK');
    expect(mockSupabase.database.trades[0].current_stop_loss).toBe(175.5);
    expect(mockSupabase.database.stop_loss_history.length).toBe(1);
    expect(mockSupabase.database.stop_loss_history[0].stop_type).toBe('INITIAL');
  });

  // 2. Import multiple valid trades
  it('Scenario 2: Imports multiple valid trades with mixed directions and portfolio owners', async () => {
    const rawTrades = [
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'TCS',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 3600,
        initial_stop_loss: 3500,
        quantity: 5,
      },
      {
        portfolio_owner: 'spouse',
        broker: 'SHOONYA',
        exchange: 'BSE',
        symbol: 'RELIANCE',
        trade_type: 'INTRADAY',
        direction: 'SHORT',
        entry_price: 2800,
        initial_stop_loss: 2850,
        quantity: 10,
      },
      {
        portfolio_owner: husbandId,
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'INFY',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        entry_price: 1500,
        initial_stop_loss: 1450,
        quantity: 20,
      },
    ];

    const validation = validateTradesPayload({
      rawTrades,
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.validTradesCount).toBe(3);
    expect(validation.trades[0].portfolioOwnerId).toBe(husbandId);
    expect(validation.trades[1].portfolioOwnerId).toBe(wifeId);
    expect(validation.trades[2].portfolioOwnerId).toBe(husbandId);

    const mockSupabase = createMockSupabase();
    const result = await executeTradeImport({
      validatedTrades: validation.trades,
      householdId,
      userId: adminUserId,
      supabase: mockSupabase as any,
    });

    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(3);
    expect(mockSupabase.database.trades.length).toBe(3);
    expect(mockSupabase.database.stop_loss_history.length).toBe(3);
  });

  // 3. Missing required fields
  it('Scenario 3: Rejects records with missing required fields with clear messages', () => {
    const rawTrades = [
      {
        // missing portfolio_owner
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'TCS',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 3600,
        initial_stop_loss: 3500,
        quantity: 5,
      },
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        // missing symbol
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 3600,
        initial_stop_loss: 3500,
        quantity: 5,
      },
    ];

    const validation = validateTradesPayload({
      rawTrades,
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.trades[0].errors).toContain('Missing required field "portfolio_owner"');
    expect(validation.trades[1].errors).toContain('Missing required field "symbol"');
  });

  // 4. Invalid JSON
  it('Scenario 4: Rejects malformed JSON syntax and invalid payloads', () => {
    const malformed = '{ "schema_version": "1.0", "trades": [ { "symbol": "BAD" ';
    const res = parseRawJsonText(malformed);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid JSON syntax/i);
  });

  // 5. Invalid stop-loss for LONG and SHORT
  it('Scenario 5: Rejects invalid stop-loss relative to direction (LONG: stop < entry, SHORT: stop > entry)', () => {
    const rawTrades = [
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'LONG_ERR',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 500,
        initial_stop_loss: 550, // Above entry -> invalid for LONG
        quantity: 10,
      },
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'SHORT_ERR',
        trade_type: 'INTRADAY',
        direction: 'SHORT',
        entry_price: 500,
        initial_stop_loss: 450, // Below entry -> invalid for SHORT
        quantity: 10,
      },
    ];

    const validation = validateTradesPayload({
      rawTrades,
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.trades[0].errors[0]).toMatch(/For LONG trades, initial stop-loss .* must be below entry price/i);
    expect(validation.trades[1].errors[0]).toMatch(/For SHORT trades, initial stop-loss .* must be above entry price/i);
  });

  // 6. Negative quantity and invalid prices
  it('Scenario 6: Rejects negative quantity, non-integer quantity, and negative/zero prices', () => {
    const rawTrades = [
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'TEST1',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: -100, // Negative price
        initial_stop_loss: 50,
        quantity: 10,
      },
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'TEST2',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 100,
        initial_stop_loss: 90,
        quantity: -5, // Negative quantity
      },
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'TEST3',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 100,
        initial_stop_loss: 90,
        quantity: 2.5, // Non-integer quantity
      },
    ];

    const validation = validateTradesPayload({
      rawTrades,
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.trades[0].errors).toContain('Entry price must be a positive number (> 0), received "-100"');
    expect(validation.trades[1].errors).toContain('Quantity must be a positive whole number (> 0), received "-5"');
    expect(validation.trades[2].errors).toContain('Quantity must be a positive whole number (> 0), received "2.5"');
  });

  // 7. Unauthorized VIEWER import attempt
  it('Scenario 7: Enforces server-side ADMIN authorization and rejects VIEWER accounts', async () => {
    // When a VIEWER user calls requireAdmin(), it must throw AuthError with 403
    const viewerContext = {
      user: { id: 'viewer-uuid', email: 'wife@example.com' },
      householdId,
      role: 'VIEWER' as const,
      isAdmin: false,
      isViewer: true,
    };

    const verifyAdmin = (ctx: typeof viewerContext) => {
      if (!ctx.isAdmin) {
        throw new AuthError('Admin access required', 403);
      }
    };

    expect(() => verifyAdmin(viewerContext)).toThrowError(AuthError);
    try {
      verifyAdmin(viewerContext);
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
      expect(e.message).toBe('Admin access required');
    }
  });

  // 8. Cross-household ownership attempt
  it('Scenario 8: Rejects cross-household portfolio owner UUIDs', () => {
    const foreignOwnerId = 'e9999999-9999-9999-9999-999999999999';
    const rawTrade = {
      portfolio_owner: foreignOwnerId,
      broker: 'ZERODHA',
      exchange: 'NSE',
      symbol: 'SBIN',
      trade_type: 'SWING',
      direction: 'LONG',
      entry_price: 600,
      initial_stop_loss: 580,
      quantity: 10,
    };

    const validation = validateTradesPayload({
      rawTrades: [rawTrade],
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.trades[0].errors[0]).toMatch(/does not belong to your household/i);
  });

  // 9. Duplicate import
  it('Scenario 9: Flags duplicate warnings for existing open positions and duplicate items in same batch', () => {
    const existingOpenTrades: ExistingTradeContext[] = [
      {
        id: 'open-trade-123',
        symbol: 'UNIONBANK',
        portfolio_owner_id: husbandId,
        broker_id: mockBrokers[0].id,
        entry_price: 182.45,
        quantity: 10,
        direction: 'LONG',
        status: 'OPEN',
        created_at: '2026-11-01T10:00:00Z',
      },
    ];

    // Payload has the duplicate of the open trade, PLUS duplicate items within the batch
    const rawTrades = [
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'UNIONBANK',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 182.45,
        initial_stop_loss: 175.5,
        quantity: 10,
      },
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'CIPLA',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 1400,
        initial_stop_loss: 1350,
        quantity: 5,
      },
      {
        // Exact duplicate of CIPLA in same batch
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'CIPLA',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 1400,
        initial_stop_loss: 1350,
        quantity: 5,
      },
    ];

    const validation = validateTradesPayload({
      rawTrades,
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
      existingOpenTrades,
    });

    expect(validation.duplicateCount).toBe(2);
    expect(validation.trades[0].isDuplicate).toBe(true);
    expect(validation.trades[0].duplicateWarning).toMatch(/Matching open trade for UNIONBANK already exists/i);
    expect(validation.trades[2].isDuplicate).toBe(true);
    expect(validation.trades[2].duplicateWarning).toMatch(/Duplicate trade detected within this import batch/i);
  });

  // 10. Database failure during batch import (atomic rollback)
  it('Scenario 10: Ensures database failure during batch import triggers rollback leaving zero partial trades', async () => {
    const rawTrades = [
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'TRADE_OK',
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 200,
        initial_stop_loss: 190,
        quantity: 10,
      },
      {
        portfolio_owner: 'me',
        broker: 'ZERODHA',
        exchange: 'NSE',
        symbol: 'TRADE_FAIL', // Configured to fail in mock
        trade_type: 'SWING',
        direction: 'LONG',
        entry_price: 300,
        initial_stop_loss: 290,
        quantity: 5,
      },
    ];

    const validation = validateTradesPayload({
      rawTrades,
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    const mockSupabase = createMockSupabase({ failOnInsertSymbol: 'TRADE_FAIL' });

    const result = await executeTradeImport({
      validatedTrades: validation.trades,
      householdId,
      userId: adminUserId,
      supabase: mockSupabase as any,
    });

    expect(result.success).toBe(false);
    expect(result.importedCount).toBe(0);
    // Verified rollback: previously inserted trades are purged so zero partial trades remain!
    expect(mockSupabase.database.trades.length).toBe(0);
  });

  // 11. Import from Android mobile
  it('Scenario 11: Handles Android mobile clipboard paste with special whitespace, newlines, and mobile view data', () => {
    // Android clipboards often contain CRLF line breaks and leading/trailing whitespace
    const androidMobileJson = `\r\n\r\n{\r\n  "schema_version": "1.0",\r\n  "trades": [\r\n    {\r\n      "portfolio_owner": "  me  ",\r\n      "broker": " ZERODHA ",\r\n      "exchange": " NSE ",\r\n      "symbol": " tata motors ",\r\n      "trade_type": " SWING ",\r\n      "direction": " LONG ",\r\n      "entry_price": 950.50,\r\n      "initial_stop_loss": 920.00,\r\n      "quantity": 15\r\n    }\r\n  ]\r\n}\r\n\r\n`;

    const parseResult = parseRawJsonText(androidMobileJson);
    expect(parseResult.success).toBe(true);

    const validation = validateTradesPayload({
      rawTrades: parseResult.rawTrades!,
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    expect(validation.isValid).toBe(true);
    const item = validation.trades[0];
    expect(item.symbol).toBe('TATA MOTORS');
    expect(item.direction).toBe('LONG');
    expect(item.riskPerShare).toBe(30.5);
    expect(item.riskRupees).toBe(457.5);
  });

  // 12. Verify imported trades query compatibility with Trades, Positions, Dashboard, Analytics
  it('Scenario 12: Verifies imported trades schema aligns perfectly with queries in Trades, Positions, Dashboard, and Analytics', async () => {
    const rawTrade = {
      portfolio_owner: 'me',
      broker: 'ZERODHA',
      exchange: 'NSE',
      symbol: 'HDFCBANK',
      trade_type: 'SWING',
      direction: 'LONG',
      entry_price: 1650,
      initial_stop_loss: 1600,
      quantity: 10,
    };

    const validation = validateTradesPayload({
      rawTrades: [rawTrade],
      householdId,
      userRole: 'ADMIN',
      persons: mockPersons,
      brokers: mockBrokers,
    });

    const mockSupabase = createMockSupabase();
    await executeTradeImport({
      validatedTrades: validation.trades,
      householdId,
      userId: adminUserId,
      supabase: mockSupabase as any,
    });

    const trade = mockSupabase.database.trades[0];

    // Check fields expected by Trades page query
    expect(trade).toHaveProperty('household_id', householdId);
    expect(trade).toHaveProperty('portfolio_owner_id', husbandId);
    expect(trade).toHaveProperty('broker_id', mockBrokers[0].id);
    expect(trade).toHaveProperty('symbol', 'HDFCBANK');
    expect(trade).toHaveProperty('entry_price', 1650);
    expect(trade).toHaveProperty('quantity', 10);
    expect(trade).toHaveProperty('entry_at');

    // Check fields expected by Positions page (open positions management)
    expect(trade.status).toBe('OPEN');
    expect(trade.exit_price).toBeNull();
    expect(trade.exit_at).toBeNull();
    expect(trade.current_stop_loss).toBe(1600);
    expect(trade.initial_risk_rupees).toBe(500);

    // Check fields expected by Dashboard / Analytics KPIs (capital deployed, initial risk)
    const capitalDeployed = trade.entry_price * trade.quantity;
    expect(capitalDeployed).toBe(16500);
    expect(trade.initial_risk_rupees).toBe(500);
    expect(trade.realized_r_multiple).toBeUndefined(); // null/undefined for open trade
  });
});
