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
});
