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

export interface TradeDetailsItem {
  portfolioOwner: string;
  broker: string;
  exchange: 'NSE' | 'BSE';
  symbol: string;
  tradeType: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number | null;
  initialStopLoss: number | null;
  quantity: number | null;
  strategy?: string;
}

export interface NormalizedGeminiMilestones {
  tradeId?: string;
  symbol?: string;
  portfolioOwner?: string;
  broker?: string;
  exchange?: 'NSE' | 'BSE';
  tradeType?: string;
  direction?: 'LONG' | 'SHORT';
  entryPrice?: number | null;
  initialStopLoss?: number | null;
  quantity?: number | null;
  strategy?: string;
  tradeDetails?: TradeDetailsItem;
  milestone1: MilestoneItem;
  milestone2: MilestoneItem;
  milestone3: MilestoneItem;
  currentTrailingStopLoss: number | null;
  lastReachedMilestone: string | null;
  timestamp: string;
  notes?: string;
  rawJson?: Record<string, unknown>;
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
 * Intelligently extracts planned trailing stop losses from notes or rationale text
 * when JSON fields contain null.
 *
 * Example:
 * "On M1 (254.10), trail stop to SL2 Estimated Net Breakeven (241.00); on M2 (258.85), trail stop to SL3 (254.10); M3 target at 266.40."
 * => { m1: 241.00, m2: 254.10, m3: null }
 */
export function extractTrailingStopsFromNotes(notes?: string | null): {
  m1: number | null;
  m2: number | null;
  m3: number | null;
} {
  const result: { m1: number | null; m2: number | null; m3: number | null } = {
    m1: null,
    m2: null,
    m3: null,
  };

  if (!notes || typeof notes !== 'string') return result;

  // Split on clause boundaries: semicolon, pipe, newline, or sentence period followed by uppercase/on/m
  const clauses = notes.split(/(?:[;\n|]|\.\s+(?=[A-Z]|on\s|m\d))/i);

  for (const rawClause of clauses) {
    const clause = rawClause.trim();
    if (!clause) continue;

    const isM1 = /\b(?:m1|milestone\s*1|milestone_1|target\s*1)\b/i.test(clause);
    const isM2 = /\b(?:m2|milestone\s*2|milestone_2|target\s*2)\b/i.test(clause);
    const isM3 = /\b(?:m3|milestone\s*3|milestone_3|target\s*3)\b/i.test(clause);

    // Strip out SL labels like SL1, SL2, SL3, SL4 so the index number isn't mistakenly parsed as a price
    const cleanClause = clause.replace(/\bSL[1-4]\b/gi, '');

    // Look for trail / stop to / trailing_stop / trailing_sl / sl to followed by a numeric price
    const match = cleanClause.match(
      /(?:trail(?:ing)?(?:\s*(?:stop(?:-loss)?|sl|_stop|_sl))?|stop\s*(?:loss\s*)?to|sl\s*(?:to|=)?)\s*(?:to|at|=|:)?\s*[^0-9]*?(\d+(?:\.\d+)?)/i
    );

    if (match) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) {
        if (isM1 && result.m1 === null) result.m1 = val;
        else if (isM2 && result.m2 === null) result.m2 = val;
        else if (isM3 && result.m3 === null) result.m3 = val;
      }
    }
  }

  return result;
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
          trailingStopLoss: parseNum(
            arr[0].trailing_stop_loss ??
            arr[0].trailingStopLoss ??
            arr[0].trailing_sl ??
            arr[0].trailing_stop ??
            arr[0].trail_sl ??
            arr[0].trail_stop ??
            arr[0].planned_trailing_stop_loss ??
            arr[0].planned_trailing_sl ??
            arr[0].stop_loss_target ??
            arr[0].sl
          ),
        };
      }
      if (arr[1]) {
        m2 = {
          targetPrice: parseNum(arr[1].target_price ?? arr[1].targetPrice ?? arr[1].target ?? arr[1].price),
          status: normalizeStatus(arr[1].status),
          trailingStopLoss: parseNum(
            arr[1].trailing_stop_loss ??
            arr[1].trailingStopLoss ??
            arr[1].trailing_sl ??
            arr[1].trailing_stop ??
            arr[1].trail_sl ??
            arr[1].trail_stop ??
            arr[1].planned_trailing_stop_loss ??
            arr[1].planned_trailing_sl ??
            arr[1].stop_loss_target ??
            arr[1].sl
          ),
        };
      }
      if (arr[2]) {
        m3 = {
          targetPrice: parseNum(arr[2].target_price ?? arr[2].targetPrice ?? arr[2].target ?? arr[2].price),
          status: normalizeStatus(arr[2].status),
          trailingStopLoss: parseNum(
            arr[2].trailing_stop_loss ??
            arr[2].trailingStopLoss ??
            arr[2].trailing_sl ??
            arr[2].trailing_stop ??
            arr[2].trail_sl ??
            arr[2].trail_stop ??
            arr[2].planned_trailing_stop_loss ??
            arr[2].planned_trailing_sl ??
            arr[2].stop_loss_target ??
            arr[2].sl
          ),
        };
      }
    } else {
      // Format 2: Nested object under `milestones` key: { milestones: { milestone_1: {...}, ... } }
      // OR top-level keys: `milestone1: { ... }` or `milestone_1: { ... }`
      let rawM1: Record<string, unknown> | undefined;
      let rawM2: Record<string, unknown> | undefined;
      let rawM3: Record<string, unknown> | undefined;

      if (raw.milestones && typeof raw.milestones === 'object' && !Array.isArray(raw.milestones)) {
        // Nested format (actual Gemini skill output):
        // { milestones: { milestone_1: { target_price, status, trailing_stop_loss }, ... } }
        const ms = raw.milestones as Record<string, unknown>;
        rawM1 = (ms.milestone_1 || ms['milestone-1'] || ms.m1 || ms.milestone1) as Record<string, unknown> | undefined;
        rawM2 = (ms.milestone_2 || ms['milestone-2'] || ms.m2 || ms.milestone2) as Record<string, unknown> | undefined;
        rawM3 = (ms.milestone_3 || ms['milestone-3'] || ms.m3 || ms.milestone3) as Record<string, unknown> | undefined;
      } else {
        // Top-level flat keys: `milestone1: { ... }` or `milestone_1: { ... }`
        rawM1 = (raw.milestone1 || raw.milestone_1 || raw.m1) as Record<string, unknown> | undefined;
        rawM2 = (raw.milestone2 || raw.milestone_2 || raw.m2) as Record<string, unknown> | undefined;
        rawM3 = (raw.milestone3 || raw.milestone_3 || raw.m3) as Record<string, unknown> | undefined;
      }

      if (rawM1 && typeof rawM1 === 'object') {
        m1 = {
          targetPrice: parseNum(rawM1.target_price ?? rawM1.targetPrice ?? rawM1.target ?? rawM1.price),
          status: normalizeStatus(rawM1.status),
          trailingStopLoss: parseNum(
            rawM1.trailing_stop_loss ??
            rawM1.trailingStopLoss ??
            rawM1.trailing_sl ??
            rawM1.trailing_stop ??
            rawM1.trail_sl ??
            rawM1.trail_stop ??
            rawM1.planned_trailing_stop_loss ??
            rawM1.planned_trailing_sl ??
            rawM1.stop_loss_target ??
            rawM1.sl
          ),
        };
      } else {
        // Flat keys: `milestone1_target_price` / `milestone1_target`
        m1 = {
          targetPrice: parseNum(raw.milestone1_target_price ?? raw.milestone1_target ?? raw.m1_target ?? raw.milestone_1_target),
          status: normalizeStatus(raw.milestone1_status ?? raw.m1_status),
          trailingStopLoss: parseNum(
            raw.milestone1_trailing_stop_loss ??
            raw.milestone1_trailing_sl ??
            raw.m1_trailing_sl ??
            raw.milestone_1_trailing_sl
          ),
        };
      }

      if (rawM2 && typeof rawM2 === 'object') {
        m2 = {
          targetPrice: parseNum(rawM2.target_price ?? rawM2.targetPrice ?? rawM2.target ?? rawM2.price),
          status: normalizeStatus(rawM2.status),
          trailingStopLoss: parseNum(
            rawM2.trailing_stop_loss ??
            rawM2.trailingStopLoss ??
            rawM2.trailing_sl ??
            rawM2.trailing_stop ??
            rawM2.trail_sl ??
            rawM2.trail_stop ??
            rawM2.planned_trailing_stop_loss ??
            rawM2.planned_trailing_sl ??
            rawM2.stop_loss_target ??
            rawM2.sl
          ),
        };
      } else {
        m2 = {
          targetPrice: parseNum(raw.milestone2_target_price ?? raw.milestone2_target ?? raw.m2_target ?? raw.milestone_2_target),
          status: normalizeStatus(raw.milestone2_status ?? raw.m2_status),
          trailingStopLoss: parseNum(
            raw.milestone2_trailing_stop_loss ??
            raw.milestone2_trailing_sl ??
            raw.m2_trailing_sl ??
            raw.milestone_2_trailing_sl
          ),
        };
      }

      if (rawM3 && typeof rawM3 === 'object') {
        m3 = {
          targetPrice: parseNum(rawM3.target_price ?? rawM3.targetPrice ?? rawM3.target ?? rawM3.price),
          status: normalizeStatus(rawM3.status),
          trailingStopLoss: parseNum(
            rawM3.trailing_stop_loss ??
            rawM3.trailingStopLoss ??
            rawM3.trailing_sl ??
            rawM3.trailing_stop ??
            rawM3.trail_sl ??
            rawM3.trail_stop ??
            rawM3.planned_trailing_stop_loss ??
            rawM3.planned_trailing_sl ??
            rawM3.stop_loss_target ??
            rawM3.sl
          ),
        };
      } else {
        m3 = {
          targetPrice: parseNum(raw.milestone3_target_price ?? raw.milestone3_target ?? raw.m3_target ?? raw.milestone_3_target),
          status: normalizeStatus(raw.milestone3_status ?? raw.m3_status),
          trailingStopLoss: parseNum(
            raw.milestone3_trailing_stop_loss ??
            raw.milestone3_trailing_sl ??
            raw.m3_trailing_sl ??
            raw.milestone_3_trailing_sl
          ),
        };
      }
    }

    // Intelligent fallback: if any milestone's trailing stop-loss is null,
    // attempt to extract it from the notes/rationale text.
    if (notes) {
      const extractedStops = extractTrailingStopsFromNotes(notes);
      if (m1.trailingStopLoss === null && extractedStops.m1 !== null) {
        m1.trailingStopLoss = extractedStops.m1;
      }
      if (m2.trailingStopLoss === null && extractedStops.m2 !== null) {
        m2.trailingStopLoss = extractedStops.m2;
      }
      if (m3.trailingStopLoss === null && extractedStops.m3 !== null) {
        m3.trailingStopLoss = extractedStops.m3;
      }
    }

    // Trade Specifications (optional when importing only milestones, required when creating trade)
    const portfolioOwner = (raw.portfolio_owner || raw.portfolioOwner || raw.owner || 'me') as string;
    const broker = (raw.broker || raw.broker_name || 'ZERODHA') as string;
    const exchange = ((raw.exchange as string)?.toUpperCase() === 'BSE' ? 'BSE' : 'NSE') as 'NSE' | 'BSE';

    // Trade Type normalization (supports SWING, DELIVERY, INTRADAY, CNC, MIS)
    let tradeType = (raw.trade_type || raw.tradeType || raw.trading_type || raw.tradingType || 'SWING') as string;
    const upperTradeType = tradeType.toUpperCase().trim();
    if (upperTradeType === 'CNC') tradeType = 'SWING';
    else if (upperTradeType === 'MIS') tradeType = 'INTRADAY';

    const direction = ((raw.direction as string)?.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT';
    const entryPrice = parseNum(raw.entry_price ?? raw.entryPrice ?? raw.price);
    const initialStopLoss = parseNum(raw.initial_stop_loss ?? raw.initialStopLoss ?? raw.stop_loss ?? raw.sl);

    // Quantity: from field or fallback to extracting from notes e.g. "Filled 30 shares"
    let quantity = parseNum(raw.quantity ?? raw.qty ?? raw.shares);
    if (quantity === null && notes) {
      const match =
        notes.match(/(?:filled\s+|qty[:\s]+|quantity[:\s]+)?(\d+)\s+shares/i) ||
        notes.match(/\bqty[:\s]+(\d+)\b/i) ||
        notes.match(/\b(\d+)\s+shares\b/i);
      if (match) {
        quantity = parseInt(match[1], 10);
      }
    }

    const strategy = (raw.strategy || raw.setup) as string | undefined;

    const tradeDetails: TradeDetailsItem | undefined = symbol
      ? {
          portfolioOwner: String(portfolioOwner).trim(),
          broker: String(broker).trim(),
          exchange,
          symbol: symbol.trim().toUpperCase(),
          tradeType,
          direction,
          entryPrice,
          initialStopLoss,
          quantity,
          strategy: strategy ? String(strategy).trim() : undefined,
        }
      : undefined;

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
        portfolioOwner: String(portfolioOwner).trim(),
        broker: String(broker).trim(),
        exchange,
        tradeType,
        direction,
        entryPrice,
        initialStopLoss,
        quantity,
        strategy: strategy ? String(strategy).trim() : undefined,
        tradeDetails,
        milestone1: m1,
        milestone2: m2,
        milestone3: m3,
        currentTrailingStopLoss: currentTrailingSL,
        lastReachedMilestone: lastReached ? String(lastReached).trim() : null,
        timestamp,
        notes: notes ? String(notes).trim() : undefined,
        rawJson: raw,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Validation error: ${(err as Error).message}`,
    };
  }
}
