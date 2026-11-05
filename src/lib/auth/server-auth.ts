/**
 * Server-side authentication helpers.
 * 
 * These functions are used in Route Handlers and Server Actions.
 * They verify authentication and authorization before any data access.
 * Never trust client-supplied household IDs or role claims.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/app';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Get the current authenticated user.
 * Throws AuthError if not authenticated.
 */
export async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError('Authentication required', 401);
  }

  return user;
}

/**
 * Get the authenticated user's household context.
 * Throws if user is not in any household.
 */
export async function requireHouseholdMember() {
  const user = await requireAuth();
  const supabase = await createSupabaseServerClient();

  const { data: membership, error } = await supabase
    .from('household_members')
    .select('household_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !membership) {
    throw new AuthError('Not a member of any household', 403);
  }

  return {
    user,
    householdId: membership.household_id,
    role: membership.role as UserRole,
    isAdmin: membership.role === 'ADMIN',
    isViewer: membership.role === 'VIEWER',
  };
}

/**
 * Require ADMIN role. Throws 403 for VIEWER accounts.
 * Use this in every mutation route handler.
 */
export async function requireAdmin() {
  const ctx = await requireHouseholdMember();

  if (!ctx.isAdmin) {
    throw new AuthError('Admin access required', 403);
  }

  return ctx;
}

/**
 * Verify that a portfolio owner (person) belongs to the authenticated user's household.
 * Prevents cross-household data access.
 */
export async function requireOwnerInHousehold(
  portfolioOwnerId: string,
  householdId: string
) {
  const supabase = await createSupabaseServerClient();

  const { data: person, error } = await supabase
    .from('persons')
    .select('id')
    .eq('id', portfolioOwnerId)
    .eq('household_id', householdId)
    .eq('is_active', true)
    .single();

  if (error || !person) {
    throw new AuthError('Invalid portfolio owner', 403);
  }

  return person;
}

/**
 * Verify that a trade belongs to the authenticated user's household.
 */
export async function requireTradeInHousehold(tradeId: string, householdId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: trade, error } = await supabase
    .from('trades')
    .select('id, household_id')
    .eq('id', tradeId)
    .eq('household_id', householdId)
    .single();

  if (error || !trade) {
    throw new AuthError('Trade not found or access denied', 404);
  }

  return trade;
}

/**
 * Wrap an API route handler with error handling for AuthErrors.
 */
export function withAuthError<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R | Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: error.statusCode, headers: { 'Content-Type': 'application/json' } }
        ) as unknown as R;
      }
      throw error;
    }
  };
}
