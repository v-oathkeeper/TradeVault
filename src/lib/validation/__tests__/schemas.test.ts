import { describe, it, expect } from 'vitest';
import {
  CreateTradeSchema,
  UpdateTradeSchema,
  ClosePositionSchema,
  UUID_REGEX,
} from '../schemas';

describe('Validation Schemas', () => {
  const husbandId = 'c1000000-0000-0000-0000-000000000001';
  const wifeId = 'c2000000-0000-0000-0000-000000000002';
  const kiteId = 'a1000000-0000-0000-0000-000000000001';
  const shoonyaId = 'a2000000-0000-0000-0000-000000000002';
  const standardUuid = '123e4567-e89b-12d3-a456-426614174000';

  it('UUID_REGEX validates both standard RFC UUIDs and deterministic hex seed IDs', () => {
    expect(UUID_REGEX.test(husbandId)).toBe(true);
    expect(UUID_REGEX.test(wifeId)).toBe(true);
    expect(UUID_REGEX.test(kiteId)).toBe(true);
    expect(UUID_REGEX.test(shoonyaId)).toBe(true);
    expect(UUID_REGEX.test(standardUuid)).toBe(true);
    expect(UUID_REGEX.test('not-a-valid-uuid')).toBe(false);
    expect(UUID_REGEX.test('')).toBe(false);
  });

  it('CreateTradeSchema successfully validates a trade with seed UUIDs', () => {
    const validTrade = {
      portfolioOwnerId: husbandId,
      brokerId: kiteId,
      tradeType: 'INTRADAY',
      direction: 'LONG',
      symbol: 'JPL',
      exchange: 'NSE',
      entryPrice: 1100,
      quantity: 6,
      entryAt: '2026-10-28T18:27',
      initialStopLoss: 1050,
      plannedTarget: 1200,
    };

    const result = CreateTradeSchema.safeParse(validTrade);
    expect(result.success).toBe(true);
  });

  it('CreateTradeSchema rejects invalid stop loss for LONG trade', () => {
    const invalidLongTrade = {
      portfolioOwnerId: husbandId,
      brokerId: kiteId,
      tradeType: 'INTRADAY',
      direction: 'LONG',
      symbol: 'JPL',
      exchange: 'NSE',
      entryPrice: 1100,
      quantity: 6,
      entryAt: '2026-10-28T18:27',
      initialStopLoss: 1150, // Above entry -> invalid for LONG
    };

    const result = CreateTradeSchema.safeParse(invalidLongTrade);
    expect(result.success).toBe(false);
  });

  it('CreateTradeSchema rejects non-UUID strings for portfolioOwnerId and brokerId', () => {
    const invalidOwner = {
      portfolioOwnerId: 'invalid-id',
      brokerId: kiteId,
      tradeType: 'INTRADAY',
      direction: 'LONG',
      symbol: 'JPL',
      exchange: 'NSE',
      entryPrice: 1100,
      quantity: 6,
      entryAt: '2026-10-28T18:27',
      initialStopLoss: 1050,
    };

    const result = CreateTradeSchema.safeParse(invalidOwner);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid portfolio owner');
    }
  });

  it('ClosePositionSchema validates exitPrice and exitAt', () => {
    const validClose = {
      tradeId: '3f1a59a2-ce7a-45af-a977-3ca266a5e2a7',
      exitPrice: 1150,
      exitAt: '2026-10-28T19:00',
    };

    const result = ClosePositionSchema.safeParse(validClose);
    expect(result.success).toBe(true);
  });
});
