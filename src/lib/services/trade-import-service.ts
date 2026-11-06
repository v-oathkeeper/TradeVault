/**
 * TradeVault — JSON Trade Import Service
 *
 * Implements full JSON parsing, schema validation, portfolio owner resolution,
 * broker resolution, risk metric calculations, duplicate detection, and
 * transactional database insertion.
 */

import {
  SUPPORTED_SCHEMA_VERSION,
  type ValidatedTradeItem,
  type ImportValidationResult,
} from '@/lib/validation/import-schema';
import { UUID_REGEX } from '@/lib/validation/schemas';
import { calculateInitialRisk } from '@/lib/calculations/r-multiple';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export interface PersonContext {
  id: string;
  household_id: string;
  display_name: string;
  relationship_label: string;
  is_active: boolean;
}

export interface BrokerContext {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface ExistingTradeContext {
  id: string;
  symbol: string;
  portfolio_owner_id: string;
  broker_id: string;
  entry_price: number;
  quantity: number;
  direction: string;
  status: string;
  created_at: string;
}

/**
 * Resolves a portfolio_owner input string to a valid Person record within the household.
 *
 * Resolves:
 * - 'me' -> Authenticated user's person record in the household
 * - 'spouse' -> The spouse person record in the household
 * - UUID -> Verifies existence in the authenticated user's household (rejects cross-household access)
 * - Name match -> Case-insensitive display_name / relationship_label match
 */
export function resolvePortfolioOwner(
  ownerInput: string,
  householdId: string,
  persons: PersonContext[],
  userRole: string = 'ADMIN'
): { person?: PersonContext; error?: string } {
  const trimmed = ownerInput.trim();
  const lower = trimmed.toLowerCase();

  const householdPersons = persons.filter(
    (p) => p.household_id === householdId && p.is_active
  );

  if (householdPersons.length === 0) {
    return { error: 'No active portfolio owners found in household' };
  }

  // 1. Resolve 'me'
  if (lower === 'me') {
    // If ADMIN (Husband in standard model)
    if (userRole === 'ADMIN') {
      const husband = householdPersons.find(
        (p) =>
          p.relationship_label?.toLowerCase().includes('husband') ||
          p.display_name?.toLowerCase().includes('husband') ||
          p.relationship_label?.toLowerCase().includes('self')
      );
      if (husband) return { person: husband };
    } else {
      // VIEWER (Wife)
      const wife = householdPersons.find(
        (p) =>
          p.relationship_label?.toLowerCase().includes('wife') ||
          p.display_name?.toLowerCase().includes('wife')
      );
      if (wife) return { person: wife };
    }
    // Fallback: first person in household
    return { person: householdPersons[0] };
  }

  // 2. Resolve 'spouse'
  if (lower === 'spouse') {
    if (userRole === 'ADMIN') {
      const wife = householdPersons.find(
        (p) =>
          p.relationship_label?.toLowerCase().includes('wife') ||
          p.display_name?.toLowerCase().includes('wife') ||
          p.relationship_label?.toLowerCase().includes('spouse')
      );
      if (wife) return { person: wife };
      // Or person who is NOT husband
      const nonHusband = householdPersons.find(
        (p) =>
          !p.relationship_label?.toLowerCase().includes('husband') &&
          !p.display_name?.toLowerCase().includes('husband')
      );
      if (nonHusband) return { person: nonHusband };
    } else {
      const husband = householdPersons.find(
        (p) =>
          p.relationship_label?.toLowerCase().includes('husband') ||
          p.display_name?.toLowerCase().includes('husband')
      );
      if (husband) return { person: husband };
    }
    return { error: 'Spouse portfolio owner not found in household' };
  }

  // 3. Resolve by permanent UUID
  if (UUID_REGEX.test(trimmed)) {
    const matched = householdPersons.find(
      (p) => p.id.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) {
      return { person: matched };
    }
    return {
      error: `Portfolio owner ID "${trimmed}" does not belong to your household or does not exist`,
    };
  }

  // 4. Resolve by name / label
  const byName = householdPersons.find(
    (p) =>
      p.display_name.toLowerCase() === lower ||
      p.relationship_label.toLowerCase() === lower
  );
  if (byName) {
    return { person: byName };
  }

  return {
    error: `Invalid portfolio_owner "${ownerInput}". Expected "me", "spouse", or a valid portfolio owner ID`,
  };
}

/**
 * Resolves broker string to active Broker record.
 * Supports 'ZERODHA' -> 'KITE', 'SHOONYA' -> 'SHOONYA'.
 */
export function resolveBroker(
  brokerInput: string,
  brokers: BrokerContext[]
): { broker?: BrokerContext; brokerCode?: 'KITE' | 'SHOONYA'; error?: string } {
  const upper = brokerInput.trim().toUpperCase();

  if (upper === 'ZERODHA' || upper === 'KITE') {
    const kiteBroker = brokers.find(
      (b) =>
        b.is_active &&
        (b.code === 'KITE' ||
          b.name.toLowerCase().includes('zerodha') ||
          b.code === 'ZERODHA')
    );
    if (kiteBroker) {
      return { broker: kiteBroker, brokerCode: 'KITE' };
    }
    // Fallback seed broker ID if not in DB yet
    return {
      broker: {
        id: 'a1000000-0000-0000-0000-000000000001',
        code: 'KITE',
        name: 'Zerodha Kite',
        is_active: true,
      },
      brokerCode: 'KITE',
    };
  }

  if (upper === 'SHOONYA') {
    const shoonyaBroker = brokers.find(
      (b) =>
        b.is_active &&
        (b.code === 'SHOONYA' || b.name.toLowerCase().includes('shoonya'))
    );
    if (shoonyaBroker) {
      return { broker: shoonyaBroker, brokerCode: 'SHOONYA' };
    }
    // Fallback seed broker ID
    return {
      broker: {
        id: 'a2000000-0000-0000-0000-000000000002',
        code: 'SHOONYA',
        name: 'Shoonya by Finvasia',
        is_active: true,
      },
      brokerCode: 'SHOONYA',
    };
  }

  return {
    error: `Invalid broker "${brokerInput}". Supported brokers: ZERODHA, SHOONYA`,
  };
}

/**
 * Resolves and validates exchange code.
 */
export function resolveExchange(
  exchangeInput: string
): { exchange?: 'NSE' | 'BSE'; error?: string } {
  const upper = exchangeInput.trim().toUpperCase();
  if (upper === 'NSE' || upper === 'BSE') {
    return { exchange: upper as 'NSE' | 'BSE' };
  }
  return {
    error: `Invalid exchange "${exchangeInput}". Supported exchanges: NSE, BSE`,
  };
}

/**
 * Resolves trade_type to domain type and database product type.
 * SWING and DELIVERY are stored as 'DELIVERY' in the database.
 */
export function resolveTradeType(
  tradeTypeInput: string
): {
  tradeType?: 'INTRADAY' | 'DELIVERY' | 'SWING';
  dbTradeType?: 'INTRADAY' | 'DELIVERY';
  error?: string;
} {
  const upper = tradeTypeInput.trim().toUpperCase();
  if (upper === 'INTRADAY') {
    return { tradeType: 'INTRADAY', dbTradeType: 'INTRADAY' };
  }
  if (upper === 'DELIVERY') {
    return { tradeType: 'DELIVERY', dbTradeType: 'DELIVERY' };
  }
  if (upper === 'SWING') {
    return { tradeType: 'SWING', dbTradeType: 'DELIVERY' };
  }
  return {
    error: `Invalid trade_type "${tradeTypeInput}". Supported trade types: INTRADAY, DELIVERY, SWING`,
  };
}

/**
 * Resolves and validates direction.
 */
export function resolveDirection(
  directionInput: string
): { direction?: 'LONG' | 'SHORT'; error?: string } {
  const upper = directionInput.trim().toUpperCase();
  if (upper === 'LONG' || upper === 'SHORT') {
    return { direction: upper as 'LONG' | 'SHORT' };
  }
  return {
    error: `Invalid direction "${directionInput}". Supported directions: LONG, SHORT`,
  };
}

/**
 * Validates symbol format (1-20 uppercase alphanumeric, &, ., -).
 */
export function validateSymbol(
  symbolInput: string
): { symbol?: string; error?: string } {
  const trimmed = symbolInput.trim().toUpperCase();
  if (!trimmed) {
    return { error: 'Symbol is required' };
  }
  if (trimmed.length > 20) {
    return { error: 'Symbol cannot exceed 20 characters' };
  }
  if (!/^[A-Z0-9&._ -]+$/.test(trimmed)) {
    return {
      error: `Symbol "${symbolInput}" contains invalid characters. Use letters, numbers, dot, or hyphen`,
    };
  }
  return { symbol: trimmed };
}

/**
 * Parses raw JSON text and extracts trades list along with schema validation.
 */
export function parseRawJsonText(jsonText: string): {
  success: boolean;
  schemaVersion?: string;
  rawTrades?: Record<string, unknown>[];
  error?: string;
} {
  if (!jsonText || !jsonText.trim()) {
    return { success: false, error: 'JSON payload is empty' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Syntax error';
    return {
      success: false,
      error: `Invalid JSON syntax: ${message}`,
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      success: false,
      error: 'JSON root must be an object with "schema_version" and "trades"',
    };
  }

  const obj = parsed as Record<string, unknown>;

  // Check schema_version
  if (!('schema_version' in obj) || typeof obj.schema_version !== 'string') {
    return {
      success: false,
      error: `Missing required field "schema_version". Expected "${SUPPORTED_SCHEMA_VERSION}"`,
    };
  }

  if (obj.schema_version.trim() !== SUPPORTED_SCHEMA_VERSION) {
    return {
      success: false,
      error: `Unsupported schema version "${obj.schema_version}". Only version "${SUPPORTED_SCHEMA_VERSION}" is supported`,
    };
  }

  // Extract trades array
  let rawTrades: Record<string, unknown>[] = [];
  if (Array.isArray(obj.trades)) {
    rawTrades = obj.trades as Record<string, unknown>[];
  } else if (obj.trade && typeof obj.trade === 'object') {
    rawTrades = [obj.trade as Record<string, unknown>];
  } else if ('symbol' in obj && 'portfolio_owner' in obj) {
    // Single trade object at root level
    const singleTrade = { ...obj };
    delete singleTrade.schema_version;
    rawTrades = [singleTrade];
  } else {
    return {
      success: false,
      error: 'JSON must contain a "trades" array with at least one trade',
    };
  }

  if (rawTrades.length === 0) {
    return {
      success: false,
      error: 'The "trades" array is empty. At least one trade is required',
    };
  }

  return {
    success: true,
    schemaVersion: obj.schema_version.trim(),
    rawTrades,
  };
}

/**
 * Core validation engine for JSON Trade Import.
 * Validates all fields, calculates risk metrics, checks for duplicates,
 * and produces itemized previews.
 */
export function validateTradesPayload({
  rawTrades,
  schemaVersion = SUPPORTED_SCHEMA_VERSION,
  householdId,
  userRole = 'ADMIN',
  persons,
  brokers,
  existingOpenTrades = [],
}: {
  rawTrades: Record<string, unknown>[];
  schemaVersion?: string;
  householdId: string;
  userRole?: string;
  persons: PersonContext[];
  brokers: BrokerContext[];
  existingOpenTrades?: ExistingTradeContext[];
}): ImportValidationResult {
  const validatedItems: ValidatedTradeItem[] = [];
  const batchKeysSeen = new Set<string>();
  let duplicateCount = 0;

  for (let index = 0; index < rawTrades.length; index++) {
    const raw = rawTrades[index] || {};
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};

    // 1. Required fields presence check
    const requiredFields = [
      'portfolio_owner',
      'broker',
      'exchange',
      'symbol',
      'trade_type',
      'direction',
      'entry_price',
      'initial_stop_loss',
      'quantity',
    ];

    for (const field of requiredFields) {
      if (!(field in raw) || raw[field] === undefined || raw[field] === null || raw[field] === '') {
        const msg = `Missing required field "${field}"`;
        errors.push(msg);
        fieldErrors[field] = msg;
      }
    }

    // 2. Portfolio owner resolution
    let resolvedPerson: PersonContext | undefined;
    const portfolioOwnerRaw = String(raw.portfolio_owner ?? '');
    if (raw.portfolio_owner) {
      const res = resolvePortfolioOwner(
        portfolioOwnerRaw,
        householdId,
        persons,
        userRole
      );
      if (res.error) {
        errors.push(res.error);
        fieldErrors.portfolio_owner = res.error;
      } else {
        resolvedPerson = res.person;
      }
    }

    // 3. Broker resolution
    let resolvedBroker: BrokerContext | undefined;
    let resolvedBrokerCode: 'KITE' | 'SHOONYA' | undefined;
    const brokerRaw = String(raw.broker ?? '');
    if (raw.broker) {
      const res = resolveBroker(brokerRaw, brokers);
      if (res.error) {
        errors.push(res.error);
        fieldErrors.broker = res.error;
      } else {
        resolvedBroker = res.broker;
        resolvedBrokerCode = res.brokerCode;
      }
    }

    // 4. Exchange resolution
    let exchange: 'NSE' | 'BSE' = 'NSE';
    if (raw.exchange) {
      const res = resolveExchange(String(raw.exchange));
      if (res.error) {
        errors.push(res.error);
        fieldErrors.exchange = res.error;
      } else {
        exchange = res.exchange!;
      }
    }

    // 5. Symbol validation
    let symbol = '';
    if (raw.symbol) {
      const res = validateSymbol(String(raw.symbol));
      if (res.error) {
        errors.push(res.error);
        fieldErrors.symbol = res.error;
      } else {
        symbol = res.symbol!;
      }
    }

    // 6. Trade type resolution
    let tradeType: 'INTRADAY' | 'DELIVERY' | 'SWING' = 'SWING';
    let dbTradeType: 'INTRADAY' | 'DELIVERY' = 'DELIVERY';
    if (raw.trade_type) {
      const res = resolveTradeType(String(raw.trade_type));
      if (res.error) {
        errors.push(res.error);
        fieldErrors.trade_type = res.error;
      } else {
        tradeType = res.tradeType!;
        dbTradeType = res.dbTradeType!;
      }
    }

    // 7. Direction resolution
    let direction: 'LONG' | 'SHORT' = 'LONG';
    if (raw.direction) {
      const res = resolveDirection(String(raw.direction));
      if (res.error) {
        errors.push(res.error);
        fieldErrors.direction = res.error;
      } else {
        direction = res.direction!;
      }
    }

    // 8. Numeric fields validation
    const entryPrice = typeof raw.entry_price === 'number' ? raw.entry_price : Number(raw.entry_price);
    const initialStopLoss =
      typeof raw.initial_stop_loss === 'number' ? raw.initial_stop_loss : Number(raw.initial_stop_loss);
    const quantity = typeof raw.quantity === 'number' ? raw.quantity : Number(raw.quantity);

    if (raw.entry_price !== undefined) {
      if (isNaN(entryPrice) || entryPrice <= 0) {
        const msg = `Entry price must be a positive number (> 0), received "${raw.entry_price}"`;
        errors.push(msg);
        fieldErrors.entry_price = msg;
      }
    }

    if (raw.initial_stop_loss !== undefined) {
      if (isNaN(initialStopLoss) || initialStopLoss <= 0) {
        const msg = `Initial stop-loss must be a positive number (> 0), received "${raw.initial_stop_loss}"`;
        errors.push(msg);
        fieldErrors.initial_stop_loss = msg;
      }
    }

    if (raw.quantity !== undefined) {
      if (isNaN(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
        const msg = `Quantity must be a positive whole number (> 0), received "${raw.quantity}"`;
        errors.push(msg);
        fieldErrors.quantity = msg;
      }
    }

    // 9. Stop-Loss & Direction relationship constraint
    if (!isNaN(entryPrice) && entryPrice > 0 && !isNaN(initialStopLoss) && initialStopLoss > 0) {
      if (direction === 'LONG' && initialStopLoss >= entryPrice) {
        const msg = `For LONG trades, initial stop-loss (${initialStopLoss}) must be below entry price (${entryPrice})`;
        errors.push(msg);
        fieldErrors.initial_stop_loss = msg;
      } else if (direction === 'SHORT' && initialStopLoss <= entryPrice) {
        const msg = `For SHORT trades, initial stop-loss (${initialStopLoss}) must be above entry price (${entryPrice})`;
        errors.push(msg);
        fieldErrors.initial_stop_loss = msg;
      }
    }

    // 10. Optional Target Price validation
    let targetPrice: number | null = null;
    if (raw.target_price !== undefined && raw.target_price !== null && raw.target_price !== '') {
      targetPrice =
        typeof raw.target_price === 'number' ? raw.target_price : Number(raw.target_price);
      if (isNaN(targetPrice) || targetPrice <= 0) {
        const msg = `Target price must be a positive number (> 0), received "${raw.target_price}"`;
        errors.push(msg);
        fieldErrors.target_price = msg;
      } else if (!isNaN(entryPrice) && entryPrice > 0) {
        if (direction === 'LONG' && targetPrice <= entryPrice) {
          const msg = `For LONG trades, target price (${targetPrice}) must be above entry price (${entryPrice})`;
          errors.push(msg);
          fieldErrors.target_price = msg;
        } else if (direction === 'SHORT' && targetPrice >= entryPrice) {
          const msg = `For SHORT trades, target price (${targetPrice}) must be below entry price (${entryPrice})`;
          errors.push(msg);
          fieldErrors.target_price = msg;
        }
      }
    }

    // 11. Strategy & Notes
    const strategy =
      typeof raw.strategy === 'string' && raw.strategy.trim()
        ? raw.strategy.trim()
        : null;
    const notes =
      typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim() : null;

    if (strategy && strategy.length > 100) {
      const msg = 'Strategy name cannot exceed 100 characters';
      errors.push(msg);
      fieldErrors.strategy = msg;
    }
    if (notes && notes.length > 1000) {
      const msg = 'Notes cannot exceed 1000 characters';
      errors.push(msg);
      fieldErrors.notes = msg;
    }

    // 12. Calculate risk metrics using R-Multiple Engine
    let riskPerShare: number | undefined;
    let riskRupees: number | undefined;
    let riskPct: number | undefined;
    let plannedRR: number | null = null;
    let r1Price: number | undefined;
    let r2Price: number | undefined;
    let r3Price: number | undefined;

    if (
      errors.length === 0 &&
      entryPrice > 0 &&
      initialStopLoss > 0 &&
      quantity > 0
    ) {
      const riskCalc = calculateInitialRisk({
        entryPrice,
        initialStopLoss,
        quantity,
        direction,
        plannedTarget: targetPrice,
      });

      if (riskCalc) {
        riskPerShare = riskCalc.riskPerShare;
        riskRupees = riskCalc.riskRupees;
        riskPct = riskCalc.riskPct;
        plannedRR = riskCalc.plannedRR;
        r1Price = riskCalc.r1Price;
        r2Price = riskCalc.r2Price;
        r3Price = riskCalc.r3Price;
      }
    }

    // 13. Duplicate detection
    let isDuplicate = false;
    let duplicateWarning: string | null = null;

    if (resolvedPerson && resolvedBroker && symbol) {
      // Check duplicate within the batch
      const batchKey = `${resolvedPerson.id}:${resolvedBroker.id}:${symbol}:${direction}:${entryPrice}:${quantity}:${initialStopLoss}`;
      if (batchKeysSeen.has(batchKey)) {
        isDuplicate = true;
        duplicateWarning = 'Duplicate trade detected within this import batch';
        duplicateCount++;
      } else {
        batchKeysSeen.add(batchKey);
      }

      // Check duplicate against existing open trades in database
      if (!isDuplicate && existingOpenTrades.length > 0) {
        const existingMatch = existingOpenTrades.find(
          (t) =>
            t.status === 'OPEN' &&
            t.portfolio_owner_id === resolvedPerson!.id &&
            t.broker_id === resolvedBroker!.id &&
            t.symbol.toUpperCase() === symbol.toUpperCase() &&
            t.direction === direction &&
            Number(t.entry_price) === entryPrice &&
            Number(t.quantity) === quantity
        );

        if (existingMatch) {
          isDuplicate = true;
          duplicateWarning = `Matching open trade for ${symbol} already exists in your journal (entry ₹${entryPrice}, qty ${quantity})`;
          duplicateCount++;
        }
      }
    }

    const isValid = errors.length === 0;

    validatedItems.push({
      index: index + 1,
      isValid,
      errors,
      fieldErrors,
      portfolioOwnerRaw,
      brokerRaw,
      exchange,
      symbol,
      tradeType,
      dbTradeType,
      direction,
      entryPrice,
      initialStopLoss,
      quantity,
      targetPrice,
      strategy,
      notes,
      portfolioOwnerId: resolvedPerson?.id,
      portfolioOwnerLabel: resolvedPerson?.display_name,
      brokerId: resolvedBroker?.id,
      brokerCode: resolvedBrokerCode,
      brokerName: resolvedBroker?.name,
      riskPerShare,
      riskRupees,
      riskPct,
      plannedRR,
      r1Price,
      r2Price,
      r3Price,
      isDuplicate,
      duplicateWarning,
    });
  }

  const validTradesCount = validatedItems.filter((i) => i.isValid).length;
  const invalidTradesCount = validatedItems.filter((i) => !i.isValid).length;

  return {
    isValid: invalidTradesCount === 0 && validTradesCount > 0,
    schemaVersion,
    totalTrades: validatedItems.length,
    validTradesCount,
    invalidTradesCount,
    duplicateCount,
    globalErrors: [],
    trades: validatedItems,
  };
}

/**
 * Executes database insertion of validated trades with atomic rollback protection.
 */
export async function executeTradeImport({
  validatedTrades,
  householdId,
  userId,
  supabase,
}: {
  validatedTrades: ValidatedTradeItem[];
  householdId: string;
  userId: string;
  supabase: SupabaseClient<Database>;
}): Promise<{
  success: boolean;
  importedCount: number;
  tradeIds: string[];
  summary: {
    successful: { index: number; symbol: string; id: string }[];
    rejected: { index: number; symbol: string; error: string }[];
  };
  error?: string;
}> {
  // Filter only valid trades
  const validList = validatedTrades.filter((t) => t.isValid);
  if (validList.length === 0) {
    return {
      success: false,
      importedCount: 0,
      tradeIds: [],
      summary: { successful: [], rejected: [] },
      error: 'No valid trades to import',
    };
  }

  // Attempt atomic PostgreSQL RPC procedure first (Migration 005)
  try {
    const payloadForRpc = validList.map((t) => ({
      portfolio_owner_id: t.portfolioOwnerId,
      broker_id: t.brokerId,
      symbol: t.symbol,
      exchange: t.exchange,
      trade_type: t.dbTradeType,
      direction: t.direction,
      quantity: t.quantity,
      entry_price: t.entryPrice,
      entry_at: new Date().toISOString(),
      initial_stop_loss: t.initialStopLoss,
      initial_risk_per_share: t.riskPerShare ?? null,
      initial_risk_rupees: t.riskRupees ?? null,
      initial_risk_pct: t.riskPct ?? null,
      planned_target: t.targetPrice ?? null,
      planned_rr: t.plannedRR ?? null,
      r1_price: t.r1Price ?? null,
      r2_price: t.r2Price ?? null,
      r3_price: t.r3Price ?? null,
      strategy_name: t.strategy ?? (t.tradeType === 'SWING' ? 'SWING' : null),
      notes: t.notes ?? null,
    }));

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'import_trades_batch',
      {
        p_household_id: householdId,
        p_user_id: userId,
        p_trades: payloadForRpc,
      }
    );

    if (!rpcError && rpcResult && typeof rpcResult === 'object' && 'success' in rpcResult && (rpcResult as { success: boolean }).success) {
      const res = rpcResult as { success: boolean; imported_count: number; trade_ids: string[] };
      const successful = validList.map((t, idx) => ({
        index: t.index,
        symbol: t.symbol,
        id: res.trade_ids[idx] || '',
      }));
      return {
        success: true,
        importedCount: res.imported_count,
        tradeIds: res.trade_ids,
        summary: { successful, rejected: [] },
      };
    }
  } catch (rpcErr) {
    // If RPC is missing or fails, fall back to transactional client sequence with compensating rollback
    console.warn('RPC import_trades_batch not available, falling back to direct insertion:', rpcErr);
  }

  // Fallback: Direct insert with compensating rollback on failure
  const insertedTradeIds: string[] = [];
  const successful: { index: number; symbol: string; id: string }[] = [];
  const rejected: { index: number; symbol: string; error: string }[] = [];

  try {
    for (const item of validList) {
      const now = new Date().toISOString();

      const { data: trade, error: insertError } = await supabase
        .from('trades')
        .insert({
          household_id: householdId,
          portfolio_owner_id: item.portfolioOwnerId!,
          broker_id: item.brokerId!,
          symbol: item.symbol,
          exchange: item.exchange,
          trade_type: item.dbTradeType,
          direction: item.direction,
          quantity: item.quantity,
          entry_price: item.entryPrice,
          exit_price: null,
          entry_at: now,
          exit_at: null,
          gross_pnl: null,
          total_charges: 0,
          net_pnl: null,
          charges_breakdown: null,
          status: 'OPEN',
          notes: item.notes ?? null,
          initial_stop_loss: item.initialStopLoss,
          initial_risk_per_share: item.riskPerShare ?? null,
          initial_risk_rupees: item.riskRupees ?? null,
          initial_risk_pct: item.riskPct ?? null,
          planned_target: item.targetPrice ?? null,
          planned_rr: item.plannedRR ?? null,
          r1_price: item.r1Price ?? null,
          r2_price: item.r2Price ?? null,
          r3_price: item.r3Price ?? null,
          strategy_name: item.strategy ?? (item.tradeType === 'SWING' ? 'SWING' : null),
          current_stop_loss: item.initialStopLoss,
          created_by: userId,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single();

      if (insertError || !trade) {
        throw new Error(
          `Failed to insert trade for ${item.symbol}: ${insertError?.message || 'Database error'}`
        );
      }

      insertedTradeIds.push(trade.id);

      // Insert initial stop-loss history record
      const { error: slError } = await supabase.from('stop_loss_history').insert({
        trade_id: trade.id,
        previous_stop: null,
        new_stop: item.initialStopLoss,
        stop_type: 'INITIAL',
        notes: 'Initial stop-loss set via JSON trade import',
        created_by: userId,
        created_at: now,
      });

      if (slError) {
        throw new Error(
          `Failed to create initial stop-loss history for ${item.symbol}: ${slError.message}`
        );
      }

      successful.push({
        index: item.index,
        symbol: item.symbol,
        id: trade.id,
      });
    }

    return {
      success: true,
      importedCount: successful.length,
      tradeIds: insertedTradeIds,
      summary: { successful, rejected },
    };
  } catch (error: unknown) {
    // Compensating rollback: delete all partially inserted trades in this batch
    const errorMsg = error instanceof Error ? error.message : 'Database error';
    console.error('Batch import failed, executing compensating rollback:', error);
    if (insertedTradeIds.length > 0) {
      await supabase.from('trades').delete().in('id', insertedTradeIds);
    }
    return {
      success: false,
      importedCount: 0,
      tradeIds: [],
      summary: {
        successful: [],
        rejected: validList.map((t) => ({
          index: t.index,
          symbol: t.symbol,
          error: errorMsg || 'Batch transaction failed',
        })),
      },
      error: errorMsg || 'Database failure during batch import',
    };
  }
}
