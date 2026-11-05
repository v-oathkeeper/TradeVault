/**
 * Zod validation schemas for TradeVault.
 * Compatible with Zod v4 & React Hook Form
 */

import { z } from 'zod';

// ============================================================
// ENUMS & PATTERNS
// ============================================================
// PostgreSQL UUID pattern: accepts standard RFC 4122 v1-v8 as well as deterministic 128-bit hex seed UUIDs
export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const uuidSchema = (message = 'Invalid UUID') =>
  z.string().regex(UUID_REGEX, { message });

export const TradeTypeSchema = z.enum(['INTRADAY', 'DELIVERY']);
export const TradeDirectionSchema = z.enum(['LONG', 'SHORT']);
export const TradeStatusSchema = z.enum(['OPEN', 'CLOSED']);
export const ExchangeCodeSchema = z.enum(['NSE', 'BSE']);
export const MovementTypeSchema = z.enum(['DEPOSIT', 'WITHDRAWAL']);
export const StopLossUpdateTypeSchema = z.enum([
  'INITIAL',
  'TRAIL',
  'BREAKEVEN',
  'PARTIAL_CLOSE',
  'MANUAL',
]);

// ============================================================
// TRADE SCHEMAS
// ============================================================

export const CreateTradeSchema = z
  .object({
    portfolioOwnerId: uuidSchema('Invalid portfolio owner'),
    brokerId: uuidSchema('Invalid broker'),
    tradeType: TradeTypeSchema,
    direction: TradeDirectionSchema,
    symbol: z
      .string()
      .min(1, { message: 'Symbol is required' })
      .max(20, { message: 'Symbol too long' }),
    exchange: ExchangeCodeSchema,
    entryPrice: z
      .number({ message: 'Entry price is required' })
      .positive({ message: 'Entry price must be positive' }),
    quantity: z
      .number({ message: 'Quantity is required' })
      .int({ message: 'Quantity must be a whole number' })
      .positive({ message: 'Quantity must be positive' }),
    entryAt: z.string().min(1, { message: 'Entry date is required' }),

    // ── Risk Management Fields ──────────────────────────────
    initialStopLoss: z
      .number({ message: 'Initial stop-loss is required' })
      .positive({ message: 'Stop-loss must be positive' }),
    plannedTarget: z.number().positive().optional().nullable(),
    strategyName: z.string().max(100).optional().nullable(),

    exitPrice: z.number().positive().optional().nullable(),
    exitAt: z.string().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Stop-loss direction validation
    if (data.direction === 'LONG' && data.initialStopLoss >= data.entryPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Stop-loss (${data.initialStopLoss}) must be BELOW entry price (${data.entryPrice}) for a LONG trade`,
        path: ['initialStopLoss'],
      });
    }
    if (data.direction === 'SHORT' && data.initialStopLoss <= data.entryPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Stop-loss (${data.initialStopLoss}) must be ABOVE entry price (${data.entryPrice}) for a SHORT trade`,
        path: ['initialStopLoss'],
      });
    }

    // Planned target direction validation (optional)
    if (data.plannedTarget != null) {
      if (data.direction === 'LONG' && data.plannedTarget <= data.entryPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Planned target must be above entry price for a LONG trade',
          path: ['plannedTarget'],
        });
      }
      if (data.direction === 'SHORT' && data.plannedTarget >= data.entryPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Planned target must be below entry price for a SHORT trade',
          path: ['plannedTarget'],
        });
      }
    }

    // Exit date required when exit price is provided
    if (data.exitPrice !== null && data.exitPrice !== undefined && Number(data.exitPrice) > 0) {
      if (!data.exitAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Exit date/time is required when exit price is provided',
          path: ['exitAt'],
        });
      }
    }
  });

export const UpdateTradeSchema = z.object({
  id: uuidSchema('Invalid trade ID'),
  portfolioOwnerId: uuidSchema('Invalid portfolio owner').optional(),
  brokerId: uuidSchema('Invalid broker').optional(),
  tradeType: TradeTypeSchema.optional(),
  direction: TradeDirectionSchema.optional(),
  symbol: z.string().min(1).max(20).optional(),
  exchange: ExchangeCodeSchema.optional(),
  entryPrice: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
  entryAt: z.string().optional(),
  initialStopLoss: z.number().positive().optional(),
  plannedTarget: z.number().positive().optional().nullable(),
  strategyName: z.string().max(100).optional().nullable(),
  exitPrice: z.number().positive().optional().nullable(),
  exitAt: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  status: TradeStatusSchema.optional(),
});

export const ClosePositionSchema = z.object({
  tradeId: uuidSchema('Invalid trade ID'),
  exitPrice: z
    .number({ message: 'Exit price is required' })
    .positive({ message: 'Exit price must be positive' }),
  exitAt: z.string().min(1, { message: 'Exit date is required' }),
  notes: z.string().max(1000).optional(),
});

export const UpdateCurrentPriceSchema = z.object({
  tradeId: uuidSchema('Invalid trade ID'),
  currentPrice: z.number().positive(),
});

/** Schema for the PATCH /api/trades/[id]/stop-loss endpoint */
export const UpdateStopLossSchema = z.object({
  newStopLoss: z
    .number({ message: 'New stop-loss price is required' })
    .positive({ message: 'Stop-loss must be positive' }),
  stopType: StopLossUpdateTypeSchema.default('TRAIL'),
  marketPriceAtUpdate: z.number().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const TradeFiltersSchema = z.object({
  personId: z.string().optional(),
  brokerId: z.string().optional(),
  tradeType: TradeTypeSchema.optional(),
  status: TradeStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  symbol: z.string().max(20).optional(),
  profitLoss: z.enum(['profit', 'loss', 'all']).optional(),
  strategyName: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  sortBy: z.enum(['entry_at', 'exit_at', 'net_pnl', 'symbol', 'created_at', 'realized_r_multiple']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const CreateCashMovementSchema = z.object({
  portfolioOwnerId: uuidSchema('Invalid portfolio owner'),
  movementType: MovementTypeSchema,
  amount: z.number().positive(),
  movementDate: z.string(),
  description: z.string().max(500).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export type CreateTradeInput = z.infer<typeof CreateTradeSchema>;
export type UpdateTradeInput = z.infer<typeof UpdateTradeSchema>;
export type ClosePositionInput = z.infer<typeof ClosePositionSchema>;
export type TradeFiltersInput = z.infer<typeof TradeFiltersSchema>;
export type CreateCashMovementInput = z.infer<typeof CreateCashMovementSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateStopLossInput = z.infer<typeof UpdateStopLossSchema>;
