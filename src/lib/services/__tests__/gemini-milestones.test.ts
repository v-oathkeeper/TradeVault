/**
 * TradeVault — Gemini Milestone Schema & Service Unit Tests
 *
 * Verifies parsing, normalization, validation, and preview logic
 * for structured Gemini trading milestone JSON inputs.
 *
 * Run: npm test -- gemini-milestones
 */

import { describe, it, expect } from 'vitest';
import { parseAndValidateGeminiJson } from '@/lib/validation/gemini-schema';

describe('Gemini Milestone JSON Parser & Normalizer', () => {
  it('parses array-based milestone JSON correctly', () => {
    const rawJson = JSON.stringify({
      symbol: 'RELIANCE',
      trade_id: 'trade-uuid-1',
      milestones: [
        { milestone: 1, target_price: 2500, status: 'REACHED', trailing_stop_loss: 2450 },
        { milestone: 2, target_price: 2550, status: 'PENDING', trailing_stop_loss: 2500 },
        { milestone: 3, target_price: 2600, status: 'PENDING', trailing_stop_loss: 2500 },
      ],
      current_trailing_sl: 2500,
      last_reached_milestone: 'M1',
      notes: 'M1 reached, stop moved to entry+profit',
    });

    const result = parseAndValidateGeminiJson(rawJson);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const data = result.data!;
    expect(data.symbol).toBe('RELIANCE');
    expect(data.tradeId).toBe('trade-uuid-1');
    expect(data.milestone1.targetPrice).toBe(2500);
    expect(data.milestone1.status).toBe('REACHED');
    expect(data.milestone1.trailingStopLoss).toBe(2450);

    expect(data.milestone2.targetPrice).toBe(2550);
    expect(data.milestone2.status).toBe('PENDING');
    expect(data.milestone2.trailingStopLoss).toBe(2500);

    expect(data.milestone3.targetPrice).toBe(2600);
    expect(data.milestone3.status).toBe('PENDING');

    expect(data.currentTrailingStopLoss).toBe(2500);
    expect(data.lastReachedMilestone).toBe('M1');
  });

  it('parses nested milestone objects format', () => {
    const rawJson = JSON.stringify({
      symbol: 'TCS',
      milestone1: { target_price: 3800, status: 'HIT', trailing_sl: 3720 },
      milestone2: { target_price: 3900, status: 'ACHIEVED', trailing_sl: 3800 },
      milestone3: { target_price: 4000, status: 'PENDING', trailing_sl: 3800 },
      current_trailing_stop: 3800,
      last_reached: 'M2',
    });

    const result = parseAndValidateGeminiJson(rawJson);
    expect(result.success).toBe(true);
    const data = result.data!;

    expect(data.symbol).toBe('TCS');
    expect(data.milestone1.targetPrice).toBe(3800);
    expect(data.milestone1.status).toBe('REACHED'); // normalized from 'HIT'
    expect(data.milestone1.trailingStopLoss).toBe(3720);

    expect(data.milestone2.targetPrice).toBe(3900);
    expect(data.milestone2.status).toBe('REACHED'); // normalized from 'ACHIEVED'
    expect(data.milestone2.trailingStopLoss).toBe(3800);

    expect(data.currentTrailingStopLoss).toBe(3800);
    expect(data.lastReachedMilestone).toBe('M2');
  });

  it('parses flat field milestone structure', () => {
    const rawJson = JSON.stringify({
      symbol: 'INFY',
      m1_target: 1800,
      m1_status: 'DONE',
      m1_trailing_sl: 1750,
      m2_target: 1850,
      m2_status: 'PENDING',
      m2_trailing_sl: 1800,
      m3_target: 1900,
      m3_status: 'PENDING',
      m3_trailing_sl: 1800,
      current_trailing_sl: 1800,
      last_reached_milestone: 'M1',
    });

    const result = parseAndValidateGeminiJson(rawJson);
    expect(result.success).toBe(true);
    const data = result.data!;

    expect(data.symbol).toBe('INFY');
    expect(data.milestone1.targetPrice).toBe(1800);
    expect(data.milestone1.status).toBe('REACHED');
    expect(data.milestone1.trailingStopLoss).toBe(1750);
    expect(data.milestone2.targetPrice).toBe(1850);
    expect(data.currentTrailingStopLoss).toBe(1800);
  });

  it('handles invalid JSON gracefully', () => {
    const invalidJson = '{ symbol: INFY, missing quotes }';
    const result = parseAndValidateGeminiJson(invalidJson);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid JSON/);
  });

  it('rejects input with no identifiable milestones', () => {
    const emptyJson = JSON.stringify({ foo: 'bar', random: 123 });
    const result = parseAndValidateGeminiJson(emptyJson);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/milestone target price/);
  });

  it('normalizes various status aliases correctly', () => {
    const json = JSON.stringify({
      milestones: [
        { milestone: 1, target: 100, status: 'completed' },
        { milestone: 2, target: 110, status: 'failed' },
        { milestone: 3, target: 120, status: 'canceled' },
      ],
    });

    const result = parseAndValidateGeminiJson(json);
    expect(result.success).toBe(true);
    const data = result.data!;
    expect(data.milestone1.status).toBe('REACHED');
    expect(data.milestone2.status).toBe('MISSED');
    expect(data.milestone3.status).toBe('CANCELLED');
  });

  it('parses actual Gemini skill export with nested milestone_1/2/3 keys', () => {
    const geminiExport = {
      schema_version: '1.0',
      source: 'gemini_trading_skill',
      updated_at: '2026-11-19T15:10:00+05:30',
      symbol: 'PPLPHARMA',
      exchange: 'NSE',
      trading_type: 'CNC',
      direction: 'LONG',
      entry_price: 239.94,
      initial_stop_loss: 230.5,
      milestones: {
        milestone_1: {
          target_price: 254.1,
          status: 'PENDING',
          trailing_stop_loss: null,
        },
        milestone_2: {
          target_price: 258.85,
          status: 'PENDING',
          trailing_stop_loss: null,
        },
        milestone_3: {
          target_price: 266.4,
          status: 'PENDING',
          trailing_stop_loss: null,
        },
      },
      last_reached_milestone: null,
      current_trailing_stop_loss: null,
      notes:
        'Filled 30 shares at 239.94 (15:08:41 IST). Milestone levels revised from 239.75 pre-fill estimate to actual 239.94 fill (1R = 9.44). On M1 (254.10), trail stop to SL2 Estimated Net Breakeven (241.00); on M2 (258.85), trail stop to SL3 (254.10); M3 target at 266.40.',
    };

    const result = parseAndValidateGeminiJson(geminiExport);
    expect(result.success).toBe(true);
    const data = result.data!;

    expect(data.symbol).toBe('PPLPHARMA');
    expect(data.milestone1.targetPrice).toBe(254.1);
    expect(data.milestone1.status).toBe('PENDING');
    // Note parser successfully extracts SL2 breakeven (241.00) from notes
    expect(data.milestone1.trailingStopLoss).toBe(241);

    expect(data.milestone2.targetPrice).toBe(258.85);
    expect(data.milestone2.status).toBe('PENDING');
    // Note parser successfully extracts SL3 (254.10) from notes
    expect(data.milestone2.trailingStopLoss).toBe(254.1);

    expect(data.milestone3.targetPrice).toBe(266.4);
    expect(data.milestone3.status).toBe('PENDING');

    expect(data.currentTrailingStopLoss).toBeNull();
    expect(data.lastReachedMilestone).toBeNull();
    expect(data.timestamp).toBe('2026-11-19T15:10:00+05:30');

    // Trade specifications and details extracted
    expect(data.portfolioOwner).toBe('me');
    expect(data.broker).toBe('ZERODHA');
    expect(data.quantity).toBe(30);
    expect(data.entryPrice).toBe(239.94);
    expect(data.initialStopLoss).toBe(230.5);
    expect(data.tradeDetails).toBeDefined();
    expect(data.tradeDetails?.quantity).toBe(30);
  });

  it('parses consistent Gemini trade schema with explicit trade details and trailing stop-losses', () => {
    const canonicalPayload = {
      schema_version: '1.0',
      source: 'gemini_trading_skill',
      updated_at: '2026-11-19T15:10:00+05:30',
      portfolio_owner: 'me',
      broker: 'ZERODHA',
      exchange: 'NSE',
      symbol: 'PPLPHARMA',
      trade_type: 'SWING',
      direction: 'LONG',
      entry_price: 239.94,
      initial_stop_loss: 230.5,
      quantity: 30,
      strategy: 'Breakout',
      milestones: {
        milestone_1: {
          target_price: 254.1,
          status: 'PENDING',
          trailing_stop_loss: 241.0,
        },
        milestone_2: {
          target_price: 258.85,
          status: 'PENDING',
          trailing_stop_loss: 254.1,
        },
        milestone_3: {
          target_price: 266.4,
          status: 'PENDING',
          trailing_stop_loss: 258.85,
        },
      },
      last_reached_milestone: null,
      current_trailing_stop_loss: null,
      notes: 'Filled 30 shares at 239.94. Risk 1R = 9.44.',
    };

    const result = parseAndValidateGeminiJson(canonicalPayload);
    expect(result.success).toBe(true);
    const data = result.data!;

    expect(data.symbol).toBe('PPLPHARMA');
    expect(data.portfolioOwner).toBe('me');
    expect(data.broker).toBe('ZERODHA');
    expect(data.exchange).toBe('NSE');
    expect(data.tradeType).toBe('SWING');
    expect(data.direction).toBe('LONG');
    expect(data.entryPrice).toBe(239.94);
    expect(data.initialStopLoss).toBe(230.5);
    expect(data.quantity).toBe(30);
    expect(data.strategy).toBe('Breakout');

    expect(data.milestone1.targetPrice).toBe(254.1);
    expect(data.milestone1.trailingStopLoss).toBe(241.0);
    expect(data.milestone2.targetPrice).toBe(258.85);
    expect(data.milestone2.trailingStopLoss).toBe(254.1);
    expect(data.milestone3.targetPrice).toBe(266.4);
    expect(data.milestone3.trailingStopLoss).toBe(258.85);
  });
});
