/**
 * TradeVault — Gemini Milestone Schema & Normalizer
 *
 * Validates structured JSON from the user's Gemini trading skill.
 * Supports nested milestones, array of milestones, and flat field structures.
 * Never computes milestone prices or trailing stop-loss values itself;
 * only parses, validates, and normalizes values received from Gemini.
 */

import { z } from 'zod';

export type MilestoneStatus = 'PENDING' | 'REACHED' | 'MISSED' | 'CANCELLED';

export interface MilestoneItem {
  targetPrice: number | null;
  status: MilestoneStatus;
  trailingStopLoss: number | null;
}

export interface NormalizedGeminiMilestones {
  tradeId?: string;
  symbol?: string;
  milestone1: MilestoneItem;
  milestone2: MilestoneItem;
  milestone3: MilestoneItem;
  currentTrailingStopLoss: number | null;
  lastReachedMilestone: string | null;
  timestamp: string;
  notes?: string;
}

const statusEnum = z.enum(['PENDING', 'REACHED', 'MISSED', 'CANCELLED']);

function normalizeStatus(val: unknown): MilestoneStatus {
  if (typeof val !== 'string') return 'PENDING';
  const upper = val.trim().toUpperCase();
  if (['REACHED', 'HIT', 'ACHIEVED', 'DONE', 'COMPLETED'].includes(upper)) return 'REACHED';
  if (['MISSED', 'FAILED'].includes(upper)) return 'MISSED';
  if (['CANCELLED', 'CANCELED'].includes(upper)) return 'CANCELLED';
  return 'PENDING';
}

function parseNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

/**
 * Validates and normalizes raw JSON text or object from Gemini trading skill.
 */
export function parseAndValidateGeminiJson(input: string | Record<string, unknown>): {
  success: boolean;
  data?: NormalizedGeminiMilestones;
  error?: string;
} {
  let raw: Record<string, unknown>;

  if (typeof input === 'string') {
    try {
      // Remove any markdown code block wrapping (e.g. ```json ... ```)
      const cleanJson = input
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      raw = JSON.parse(cleanJson);
    } catch (e) {
      return {
        success: false,
        error: `Invalid JSON syntax: ${(e as Error).message}`,
      };
    }
  } else if (typeof input === 'object' && input !== null) {
    raw = input;
  } else {
    return { success: false, error: 'Input must be a valid JSON string or object.' };
  }

  try {
    const tradeId = (raw.trade_id || raw.tradeId || raw.id) as string | undefined;
    const symbol = (raw.symbol || raw.scrip || raw.ticker) as string | undefined;
    const notes = (raw.notes || raw.comment || raw.description) as string | undefined;

    // Last reached milestone
    const lastReached = (raw.last_reached_milestone ||
      raw.lastReachedMilestone ||
      raw.last_reached ||
      raw.current_milestone) as string | undefined;

    // Current active trailing stop loss
    const currentTrailingSL = parseNum(
      raw.current_active_trailing_stop_loss ??
      raw.current_active_trailing_sl ??
      raw.current_trailing_stop_loss ??
      raw.current_trailing_sl ??
      raw.current_trailing_stop ??
      raw.currentTrailingStopLoss ??
      raw.active_trailing_stop_loss ??
      raw.active_stop_loss
    );

    // Timestamp
    const timestamp = (raw.timestamp ||
      raw.updated_at ||
      raw.updatedAt ||
      raw.last_update_timestamp ||
      new Date().toISOString()) as string;

    // Normalize milestone 1, 2, 3
    let m1: MilestoneItem = { targetPrice: null, status: 'PENDING', trailingStopLoss: null };
    let m2: MilestoneItem = { targetPrice: null, status: 'PENDING', trailingStopLoss: null };
    let m3: MilestoneItem = { targetPrice: null, status: 'PENDING', trailingStopLoss: null };

    // Format 1: Array of milestones `milestones: [...]`
    if (Array.isArray(raw.milestones)) {
      const arr = raw.milestones;
      if (arr[0]) {
        m1 = {
          targetPrice: parseNum(arr[0].target_price ?? arr[0].targetPrice ?? arr[0].target ?? arr[0].price),
          status: normalizeStatus(arr[0].status),
          trailingStopLoss: parseNum(arr[0].trailing_stop_loss ?? arr[0].trailingStopLoss ?? arr[0].trailing_sl ?? arr[0].sl),
        };
      }
      if (arr[1]) {
        m2 = {
          targetPrice: parseNum(arr[1].target_price ?? arr[1].targetPrice ?? arr[1].target ?? arr[1].price),
          status: normalizeStatus(arr[1].status),
          trailingStopLoss: parseNum(arr[1].trailing_stop_loss ?? arr[1].trailingStopLoss ?? arr[1].trailing_sl ?? arr[1].sl),
        };
      }
      if (arr[2]) {
        m3 = {
          targetPrice: parseNum(arr[2].target_price ?? arr[2].targetPrice ?? arr[2].target ?? arr[2].price),
          status: normalizeStatus(arr[2].status),
          trailingStopLoss: parseNum(arr[2].trailing_stop_loss ?? arr[2].trailingStopLoss ?? arr[2].trailing_sl ?? arr[2].sl),
        };
      }
    } else {
      // Format 2: Objects `milestone1: { ... }` or `milestone_1: { ... }`
      const rawM1 = (raw.milestone1 || raw.milestone_1 || raw.m1) as Record<string, unknown> | undefined;
      const rawM2 = (raw.milestone2 || raw.milestone_2 || raw.m2) as Record<string, unknown> | undefined;
      const rawM3 = (raw.milestone3 || raw.milestone_3 || raw.m3) as Record<string, unknown> | undefined;

      if (rawM1 && typeof rawM1 === 'object') {
        m1 = {
          targetPrice: parseNum(rawM1.target_price ?? rawM1.targetPrice ?? rawM1.target ?? rawM1.price),
          status: normalizeStatus(rawM1.status),
          trailingStopLoss: parseNum(rawM1.trailing_stop_loss ?? rawM1.trailingStopLoss ?? rawM1.trailing_sl ?? rawM1.sl),
        };
      } else {
        // Flat keys: `milestone1_target_price` / `milestone1_target`
        m1 = {
          targetPrice: parseNum(raw.milestone1_target_price ?? raw.milestone1_target ?? raw.m1_target ?? raw.milestone_1_target),
          status: normalizeStatus(raw.milestone1_status ?? raw.m1_status),
          trailingStopLoss: parseNum(raw.milestone1_trailing_stop_loss ?? raw.milestone1_trailing_sl ?? raw.m1_trailing_sl),
        };
      }

      if (rawM2 && typeof rawM2 === 'object') {
        m2 = {
          targetPrice: parseNum(rawM2.target_price ?? rawM2.targetPrice ?? rawM2.target ?? rawM2.price),
          status: normalizeStatus(rawM2.status),
          trailingStopLoss: parseNum(rawM2.trailing_stop_loss ?? rawM2.trailingStopLoss ?? rawM2.trailing_sl ?? rawM2.sl),
        };
      } else {
        m2 = {
          targetPrice: parseNum(raw.milestone2_target_price ?? raw.milestone2_target ?? raw.m2_target ?? raw.milestone_2_target),
          status: normalizeStatus(raw.milestone2_status ?? raw.m2_status),
          trailingStopLoss: parseNum(raw.milestone2_trailing_stop_loss ?? raw.milestone2_trailing_sl ?? raw.m2_trailing_sl),
        };
      }

      if (rawM3 && typeof rawM3 === 'object') {
        m3 = {
          targetPrice: parseNum(rawM3.target_price ?? rawM3.targetPrice ?? rawM3.target ?? rawM3.price),
          status: normalizeStatus(rawM3.status),
          trailingStopLoss: parseNum(rawM3.trailing_stop_loss ?? rawM3.trailingStopLoss ?? rawM3.trailing_sl ?? rawM3.sl),
        };
      } else {
        m3 = {
          targetPrice: parseNum(raw.milestone3_target_price ?? raw.milestone3_target ?? raw.m3_target ?? raw.milestone_3_target),
          status: normalizeStatus(raw.milestone3_status ?? raw.m3_status),
          trailingStopLoss: parseNum(raw.milestone3_trailing_stop_loss ?? raw.milestone3_trailing_sl ?? raw.m3_trailing_sl),
        };
      }
    }

    // Validation: at least one milestone or active stop loss must be present
    const hasAnyTarget = m1.targetPrice != null || m2.targetPrice != null || m3.targetPrice != null;
    const hasAnyStop = m1.trailingStopLoss != null || m2.trailingStopLoss != null || m3.trailingStopLoss != null || currentTrailingSL != null;

    if (!hasAnyTarget && !hasAnyStop) {
      return {
        success: false,
        error: 'JSON must contain at least one milestone target price or trailing stop-loss price.',
      };
    }

    return {
      success: true,
      data: {
        tradeId: tradeId?.trim(),
        symbol: symbol?.trim().toUpperCase(),
        milestone1: m1,
        milestone2: m2,
        milestone3: m3,
        currentTrailingStopLoss: currentTrailingSL,
        lastReachedMilestone: lastReached ? String(lastReached).trim() : null,
        timestamp,
        notes: notes ? String(notes).trim() : undefined,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Validation error: ${(err as Error).message}`,
    };
  }
}
