import { describe, it, expect } from 'vitest';
import {
  parseRawJsonText,
  resolvePortfolioOwner,
  resolveBroker,
  resolveExchange,
  resolveTradeType,
  resolveDirection,
  validateSymbol,
} from '@/lib/services/trade-import-service';

describe('JSON Trade Import Schemas & Resolvers', () => {
  const husbandId = 'c1000000-0000-0000-0000-000000000001';
  const wifeId = 'c2000000-0000-0000-0000-000000000002';
  const householdId = 'b1000000-0000-0000-0000-000000000001';

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

  describe('parseRawJsonText', () => {
    it('successfully parses canonical envelope with schema_version 1.0 and trades array', () => {
      const validJson = JSON.stringify({
        schema_version: '1.0',
        trades: [
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
        ],
      });

      const res = parseRawJsonText(validJson);
      expect(res.success).toBe(true);
      expect(res.schemaVersion).toBe('1.0');
      expect(res.rawTrades?.length).toBe(1);
      expect(res.rawTrades?.[0].symbol).toBe('UNIONBANK');
    });

    it('rejects invalid JSON syntax', () => {
      const badJson = '{\n  "schema_version": "1.0",\n  trades: [bad-syntax]\n}';
      const res = parseRawJsonText(badJson);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Invalid JSON syntax/i);
    });

    it('rejects missing schema_version', () => {
      const noVersion = JSON.stringify({
        trades: [
          {
            symbol: 'SBIN',
          },
        ],
      });
      const res = parseRawJsonText(noVersion);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Missing required field "schema_version"/i);
    });

    it('rejects unsupported schema_version (e.g. 2.0)', () => {
      const futureVersion = JSON.stringify({
        schema_version: '2.0',
        trades: [{ symbol: 'INFY' }],
      });
      const res = parseRawJsonText(futureVersion);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Unsupported schema version "2.0"/i);
    });

    it('rejects empty payload or empty trades array', () => {
      const emptyPayload = JSON.stringify({
        schema_version: '1.0',
        trades: [],
      });
      const res = parseRawJsonText(emptyPayload);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/empty/i);
    });

    it('gracefully accepts single trade object wrapped with schema_version', () => {
      const singleTrade = JSON.stringify({
        schema_version: '1.0',
        portfolio_owner: 'me',
        broker: 'SHOONYA',
        exchange: 'NSE',
        symbol: 'TCS',
        trade_type: 'DELIVERY',
        direction: 'LONG',
        entry_price: 3500,
        initial_stop_loss: 3400,
        quantity: 5,
      });
      const res = parseRawJsonText(singleTrade);
      expect(res.success).toBe(true);
      expect(res.rawTrades?.length).toBe(1);
      expect(res.rawTrades?.[0].symbol).toBe('TCS');
    });
  });

  describe('Portfolio Owner Resolution & Household Security', () => {
    it('resolves "me" to Husband person record when ADMIN is authenticated', () => {
      const res = resolvePortfolioOwner('me', householdId, mockPersons, 'ADMIN');
      expect(res.person).toBeDefined();
      expect(res.person?.id).toBe(husbandId);
      expect(res.person?.display_name).toBe('Husband');
    });

    it('resolves "spouse" to Wife person record when ADMIN is authenticated', () => {
      const res = resolvePortfolioOwner('spouse', householdId, mockPersons, 'ADMIN');
      expect(res.person).toBeDefined();
      expect(res.person?.id).toBe(wifeId);
      expect(res.person?.display_name).toBe('Wife');
    });

    it('resolves valid household UUID to correct person', () => {
      const res = resolvePortfolioOwner(wifeId, householdId, mockPersons, 'ADMIN');
      expect(res.person).toBeDefined();
      expect(res.person?.id).toBe(wifeId);
    });

    it('rejects cross-household person UUID attempt', () => {
      const foreignPersonId = '99999999-9999-9999-9999-999999999999';
      const res = resolvePortfolioOwner(foreignPersonId, householdId, mockPersons, 'ADMIN');
      expect(res.error).toMatch(/does not belong to your household/i);
    });

    it('rejects unknown portfolio owner string', () => {
      const res = resolvePortfolioOwner('random_person', householdId, mockPersons, 'ADMIN');
      expect(res.error).toMatch(/Invalid portfolio_owner/i);
    });
  });

  describe('Broker & Exchange Resolution', () => {
    it('resolves "ZERODHA" to KITE broker', () => {
      const res = resolveBroker('ZERODHA', mockBrokers);
      expect(res.brokerCode).toBe('KITE');
      expect(res.broker?.id).toBe(mockBrokers[0].id);
    });

    it('resolves "SHOONYA" to SHOONYA broker', () => {
      const res = resolveBroker('SHOONYA', mockBrokers);
      expect(res.brokerCode).toBe('SHOONYA');
      expect(res.broker?.id).toBe(mockBrokers[1].id);
    });

    it('rejects unsupported broker', () => {
      const res = resolveBroker('ROBINHOOD', mockBrokers);
      expect(res.error).toMatch(/Invalid broker/i);
    });

    it('resolves "NSE" and "BSE" and rejects foreign exchange', () => {
      expect(resolveExchange('NSE').exchange).toBe('NSE');
      expect(resolveExchange('BSE').exchange).toBe('BSE');
      expect(resolveExchange('NASDAQ').error).toMatch(/Invalid exchange/i);
    });
  });

  describe('Trade Type & Direction Resolution', () => {
    it('maps SWING trade_type to DELIVERY for DB engine', () => {
      const res = resolveTradeType('SWING');
      expect(res.tradeType).toBe('SWING');
      expect(res.dbTradeType).toBe('DELIVERY');
    });

    it('maps DELIVERY and INTRADAY correctly', () => {
      expect(resolveTradeType('DELIVERY').dbTradeType).toBe('DELIVERY');
      expect(resolveTradeType('INTRADAY').dbTradeType).toBe('INTRADAY');
      expect(resolveTradeType('CRYPTO').error).toMatch(/Invalid trade_type/i);
    });

    it('resolves LONG and SHORT directions', () => {
      expect(resolveDirection('LONG').direction).toBe('LONG');
      expect(resolveDirection('SHORT').direction).toBe('SHORT');
      expect(resolveDirection('HOLD').error).toMatch(/Invalid direction/i);
    });

    it('validates symbol uppercase and format', () => {
      expect(validateSymbol('infy').symbol).toBe('INFY');
      expect(validateSymbol('M&M').symbol).toBe('M&M');
      expect(validateSymbol('BAJAJ-AUTO').symbol).toBe('BAJAJ-AUTO');
      expect(validateSymbol('INVALID$SYM').error).toMatch(/invalid characters/i);
    });
  });
});
