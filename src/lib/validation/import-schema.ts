/**
 * Zod validation schemas and helpers for JSON Trade Import.
 * Supports single and multiple trade JSON imports following schema version 1.0.
 * Compatible with Zod v4.
 */

import { z } from 'zod';

export const SUPPORTED_SCHEMA_VERSION = '1.0';

export const SUPPORTED_BROKERS = ['ZERODHA', 'SHOONYA', 'KITE'] as const;
export const SUPPORTED_EXCHANGES = ['NSE', 'BSE'] as const;
export const SUPPORTED_TRADE_TYPES = ['INTRADAY', 'DELIVERY', 'SWING'] as const;
export const SUPPORTED_DIRECTIONS = ['LONG', 'SHORT'] as const;

/**
 * Raw JSON item structure from incoming JSON payload.
 */
export const RawTradeItemSchema = z.object({
  portfolio_owner: z
    .string({ message: 'portfolio_owner is required' })
    .min(1, { message: 'portfolio_owner cannot be empty' }),
  broker: z
    .string({ message: 'broker is required' })
    .min(1, { message: 'broker cannot be empty' }),
  exchange: z
    .string({ message: 'exchange is required' })
    .min(1, { message: 'exchange cannot be empty' }),
  symbol: z
    .string({ message: 'symbol is required' })
    .min(1, { message: 'symbol cannot be empty' })
    .max(20, { message: 'symbol cannot exceed 20 characters' }),
  trade_type: z
    .string({ message: 'trade_type is required' })
    .min(1, { message: 'trade_type cannot be empty' }),
  direction: z
    .string({ message: 'direction is required' })
    .min(1, { message: 'direction cannot be empty' }),
  entry_price: z
    .number({ message: 'entry_price must be a number' })
    .positive({ message: 'entry_price must be positive (> 0)' }),
  initial_stop_loss: z
    .number({ message: 'initial_stop_loss must be a number' })
    .positive({ message: 'initial_stop_loss must be positive (> 0)' }),
  quantity: z
    .number({ message: 'quantity must be a number' })
    .int({ message: 'quantity must be a whole number' })
    .positive({ message: 'quantity must be positive (> 0)' }),
  target_price: z
    .number({ message: 'target_price must be a number' })
    .positive({ message: 'target_price must be positive (> 0)' })
    .optional()
    .nullable(),
  strategy: z
    .string({ message: 'strategy must be a string' })
    .max(100, { message: 'strategy cannot exceed 100 characters' })
    .optional()
    .nullable(),
  notes: z
    .string({ message: 'notes must be a string' })
    .max(1000, { message: 'notes cannot exceed 1000 characters' })
    .optional()
    .nullable(),
});

export type RawTradeItem = z.infer<typeof RawTradeItemSchema>;

/**
 * Standard Envelope Schema for JSON Import.
 */
export const JsonImportEnvelopeSchema = z.object({
  schema_version: z.string({ message: 'schema_version is required' }),
  trades: z
    .array(z.record(z.string(), z.unknown()))
    .min(1, { message: 'trades array must contain at least one trade' }),
});

export type JsonImportEnvelope = z.infer<typeof JsonImportEnvelopeSchema>;

/**
 * Validated and normalized trade item ready for preview and database creation.
 */
export interface ValidatedTradeItem {
  index: number;
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
  
  // Normalized raw inputs
  portfolioOwnerRaw: string;
  brokerRaw: string;
  exchange: 'NSE' | 'BSE';
  symbol: string;
  tradeType: 'INTRADAY' | 'DELIVERY' | 'SWING';
  dbTradeType: 'INTRADAY' | 'DELIVERY';
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  initialStopLoss: number;
  quantity: number;
  targetPrice: number | null;
  strategy: string | null;
  notes: string | null;

  // Resolved foreign keys & metadata
  portfolioOwnerId?: string;
  portfolioOwnerLabel?: string;
  brokerId?: string;
  brokerCode?: 'KITE' | 'SHOONYA';
  brokerName?: string;

  // Calculated risk metrics (via R-multiple engine)
  riskPerShare?: number;
  riskRupees?: number;
  riskPct?: number;
  plannedRR?: number | null;
  r1Price?: number;
  r2Price?: number;
  r3Price?: number;

  // Duplicate checks
  isDuplicate?: boolean;
  duplicateWarning?: string | null;
}

/**
 * Import validation result summary.
 */
export interface ImportValidationResult {
  isValid: boolean;
  schemaVersion: string;
  totalTrades: number;
  validTradesCount: number;
  invalidTradesCount: number;
  duplicateCount: number;
  globalErrors: string[];
  trades: ValidatedTradeItem[];
}
