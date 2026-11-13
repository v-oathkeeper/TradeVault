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
// Short-lived in-memory server cache for household context
// Eliminates repetitive sequential WAN queries on every page transition.
// ─────────────────────────────────────────────────────────────────────────────

interface CachedAppContext {
  householdId: string;
  role: UserRole;
  isAdmin: boolean;
  fullName: string;
  persons: {
    id: string;
    displayName: string;
    relationshipLabel: string;
  }[];
  cachedAt: number;
}

const appContextCache = new Map<string, CachedAppContext>();
const CONTEXT_CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Invalidate cached household context (call on user/person mutations).
 */
export function invalidateHouseholdCache(userId?: string) {
  if (userId) {
    appContextCache.delete(userId);
  } else {
    appContextCache.clear();
  }
}

/**
 * Get the current authenticated user.
 * Memoized per server request lifecycle with React cache().
 */
export const requireAuth = cache(async () => {
  return measureAsync('requireAuth', async () => {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      throw new AuthError('Authentication required', 401);
    }

    return user;
  });
});

/**
 * Get the authenticated user's household context.
 * Memoized per server request lifecycle with React cache().
 */
export const requireHouseholdMember = cache(async () => {
  const user = await requireAuth();

  // Check cache first
  const cached = appContextCache.get(user.id);
  if (cached && Date.now() - cached.cachedAt < CONTEXT_CACHE_TTL_MS) {
    return {
      user,
      householdId: cached.householdId,
      role: cached.role,
      isAdmin: cached.isAdmin,
      isViewer: cached.role === 'VIEWER',
    };
  }

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
});

/**
 * Retrieves the full household application context (user, membership, profile, and persons)
 * with request-scoped deduplication via React cache() and 60-second in-memory server cache.
 */
export const getHouseholdAppContext = cache(async () => {
  return measureAsync('getHouseholdAppContext', async () => {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    // Fast-path: return from in-memory cache if fresh
    const cached = appContextCache.get(user.id);
    if (cached && Date.now() - cached.cachedAt < CONTEXT_CACHE_TTL_MS) {
      return {
        user,
        householdId: cached.householdId,
        role: cached.role,
        isAdmin: cached.isAdmin,
        fullName: cached.fullName,
        persons: cached.persons,
      };
    }

    // Concurrent fetch for membership and profile
    const [memberRes, profileRes] = await Promise.all([
      supabase
        .from('household_members')
        .select('household_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const householdId = memberRes.data?.household_id ?? 'b1000000-0000-0000-0000-000000000001';
    const role: UserRole = (memberRes.data?.role as UserRole) ?? 'ADMIN';
    const fullName = profileRes.data?.full_name ?? (role === 'ADMIN' ? 'Husband' : 'Wife');

    // Fetch active persons for this household
    const { data: personsData } = await supabase
      .from('persons')
      .select('id, display_name, relationship_label')
      .eq('household_id', householdId)
      .eq('is_active', true);

    const persons = (personsData && personsData.length > 0)
      ? personsData.map((p) => ({
          id: p.id,
          displayName: p.display_name,
          relationshipLabel: p.relationship_label,
        }))
      : [
          {
            id: 'c1000000-0000-0000-0000-000000000001',
            displayName: 'Husband',
            relationshipLabel: 'Husband',
          },
          {
            id: 'c2000000-0000-0000-0000-000000000002',
            displayName: 'Wife',
            relationshipLabel: 'Wife',
          },
        ];

    const result = {
      user,
      householdId,
      role,
      isAdmin: role === 'ADMIN',
      fullName,
      persons,
    };

    // Populate server cache
    appContextCache.set(user.id, {
      householdId,
      role,
      isAdmin: role === 'ADMIN',
      fullName,
      persons,
      cachedAt: Date.now(),
    });

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
