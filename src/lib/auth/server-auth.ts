/**
 * Server-side authentication helpers.
 * 
 * These functions are used in Route Handlers and Server Actions.
 * They verify authentication and authorization before any data access.
 * Never trust client-supplied household IDs or role claims.
 */

import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { measureAsync } from '@/lib/perf';
import type { UserRole } from '@/types/app';

interface AuthenticatedUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// React cache() deduplicates authentication reads within a server request.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify the current access token and return the identity fields used by the app.
 * Memoized per server request lifecycle with React cache().
 */
export const requireAuth = cache(async () => {
  return measureAsync('requireAuth', async () => {
    const supabase = await createSupabaseServerClient();
    let result: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
    try {
      result = await supabase.auth.getClaims();
    } catch {
      throw new AuthError('Authentication service is unavailable', 503);
    }
    const { data, error } = result;

    if (error) {
      const isAuthFailure = error.status === 400 || error.status === 401 || error.status === 403;
      throw new AuthError(
        isAuthFailure ? 'Authentication required' : 'Authentication service is unavailable',
        isAuthFailure ? 401 : 503
      );
    }

    const claims = data?.claims;
    if (!claims || typeof claims.sub !== 'string' || !claims.sub) {
      throw new AuthError('Authentication required', 401);
    }

    const userMetadata =
      claims.user_metadata && typeof claims.user_metadata === 'object'
        ? (claims.user_metadata as Record<string, unknown>)
        : undefined;

    return {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : undefined,
      user_metadata: userMetadata,
    } satisfies AuthenticatedUser;
  });
});

/**
 * Get the authenticated user's household context.
 * Memoized per server request lifecycle with React cache().
 */
export const requireHouseholdMember = cache(async () => {
  const user = await requireAuth();
  const supabase = await createSupabaseServerClient();

  const { data: membership, error } = await supabase
    .from('household_members')
    .select('household_id, role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new AuthError('Unable to verify household membership', 503);
  }

  if (!membership) {
    throw new AuthError('Not a member of any household', 403);
  }

  return {
    user,
    householdId: membership.household_id,
    role: membership.role as UserRole,
    isAdmin: membership.role === 'ADMIN',
    isViewer: membership.role === 'VIEWER',
  };
});

/**
 * Retrieves the full household application context (user, membership, profile, and persons)
 * with request-scoped deduplication via React cache().
 */
export const getHouseholdAppContext = cache(async () => {
  return measureAsync('getHouseholdAppContext', async () => {
    const user = await requireAuth();
    const supabase = await createSupabaseServerClient();

    // Resolve authorization from the database so role changes take effect at
    // once. Avoid a separate profile round trip on every page; auth metadata
    // and email provide a display-name fallback without blocking the workspace.
    const { data: member, error: memberError } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (memberError) {
      throw new AuthError('Unable to verify household membership', 503);
    }
    if (!member) {
      throw new AuthError('Not a member of any household', 403);
    }

    const householdId = member.household_id;
    const role = member.role as UserRole;
    const metadataName =
      typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === 'string'
          ? user.user_metadata.name
          : '';
    const fullName = metadataName.trim() || user.email?.split('@')[0] || 'Account';

    // Fetch active persons for this household
    const { data: personsData, error: personsError } = await supabase
      .from('persons')
      .select('id, display_name, relationship_label')
      .eq('household_id', householdId)
      .eq('is_active', true);

    if (personsError) {
      throw new AuthError('Unable to load household members', 503);
    }

    const persons = (personsData ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      relationshipLabel: p.relationship_label,
    }));

    const result = {
      user,
      householdId,
      role,
      isAdmin: role === 'ADMIN',
      fullName,
      persons,
    };

    return result;
  });
});

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
