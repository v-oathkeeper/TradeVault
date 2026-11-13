import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/trades',
  '/positions',
  '/capital',
  '/analytics',
  '/people',
  '/exports',
  '/reports',
  '/settings',
];

// Public routes that should redirect to dashboard if already authenticated
const AUTH_ROUTES = ['/login'];

const isDev = process.env.NODE_ENV === 'development';

/**
 * Extracts the access token string from Supabase auth cookies (handles single and chunked cookies).
 */
function getAuthTokenFromCookies(cookies: { name: string; value: string }[]): string | null {
  const authCookies = cookies
    .filter((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
    .sort((a, b) => {
      const idxA = a.name.includes('.') ? parseInt(a.name.split('.').pop() || '0', 10) : 0;
      const idxB = b.name.includes('.') ? parseInt(b.name.split('.').pop() || '0', 10) : 0;
      return idxA - idxB;
    });

  if (authCookies.length === 0) return null;

  const rawValue = authCookies.map((c) => c.value).join('');
  try {
    let jsonStr = rawValue;
    if (jsonStr.startsWith('base64-')) {
      jsonStr = atob(jsonStr.slice(7));
    }
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
      return parsed[0];
    }
    if (parsed && typeof parsed === 'object') {
      return parsed.access_token || null;
    }
    if (typeof parsed === 'string') {
      return parsed;
    }
  } catch {
    if (rawValue.split('.').length === 3) {
      return rawValue;
    }
  }
  return null;
}

/**
 * Parses unverified JWT payload without cryptographic signature verification (safe for expiry checks).
 */
function parseJwtPayload(token: string): { exp?: number; sub?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const startTime = performance.now();
  const { pathname } = request.nextUrl;
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';

  // Quick bypass for API routes — they handle their own JSON authentication
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next({ request });
    if (isDev) {
      const dur = performance.now() - startTime;
      response.headers.set('Server-Timing', `proxy;dur=${dur.toFixed(1)}`);
    }
    return response;
  }

  const allCookies = request.cookies.getAll();
  const token = getAuthTokenFromCookies(allCookies);
  const jwtPayload = token ? parseJwtPayload(token) : null;
  const nowSec = Math.floor(Date.now() / 1000);

  // Check if session token is present and not expiring in the next 60 seconds
  const hasActiveSession =
    jwtPayload?.exp != null && jwtPayload.exp > nowSec + 60 && !!jwtPayload.sub;

  // ─────────────────────────────────────────────────────────────────────────────
  // Fast Path 1: Unauthenticated user (Zero network round-trips)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!token || !jwtPayload) {
    if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
      const res = NextResponse.next({ request });
      if (isDev) res.headers.set('Server-Timing', `proxy;dur=${(performance.now() - startTime).toFixed(1)}`);
      return res;
    }

    if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(redirectUrl);
      if (isDev) res.headers.set('Server-Timing', `proxy;dur=${(performance.now() - startTime).toFixed(1)}`);
      return res;
    }

    if (pathname === '/') {
      const res = NextResponse.redirect(new URL('/login', request.url));
      if (isDev) res.headers.set('Server-Timing', `proxy;dur=${(performance.now() - startTime).toFixed(1)}`);
      return res;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Fast Path 2: Active, unexpired session (Zero network round-trips for navigations & prefetches)
  // ─────────────────────────────────────────────────────────────────────────────
  if (hasActiveSession) {
    // If authenticated user visits /login, redirect to dashboard
    if (AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
      const res = NextResponse.redirect(new URL('/dashboard', request.url));
      if (isDev) res.headers.set('Server-Timing', `proxy;dur=${(performance.now() - startTime).toFixed(1)}`);
      return res;
    }

    if (pathname === '/') {
      const res = NextResponse.redirect(new URL('/dashboard', request.url));
      if (isDev) res.headers.set('Server-Timing', `proxy;dur=${(performance.now() - startTime).toFixed(1)}`);
      return res;
    }

    // Attach verified user hint headers for downstream server components
    const requestHeaders = new Headers(request.headers);
    if (jwtPayload.sub) requestHeaders.set('x-user-id', jwtPayload.sub);
    if (jwtPayload.email) requestHeaders.set('x-user-email', jwtPayload.email);

    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    const dur = performance.now() - startTime;
    res.headers.set('Server-Timing', `proxy;dur=${dur.toFixed(1)}`);
    if (isDev && !isPrefetch) {
      console.log(`[PERF:proxy] Fast-path ${pathname}: ${dur.toFixed(1)}ms`);
    }
    return res;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Slow Path: Token is expired or expiring soon — refresh session via Supabase
  // (Skips remote refresh on prefetch to avoid connection queue congestion)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isPrefetch) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect authenticated users away from auth pages
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users from protected routes to login
  if (!user && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect root to dashboard or login
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(user ? '/dashboard' : '/login', request.url)
    );
  }

  const dur = performance.now() - startTime;
  supabaseResponse.headers.set('Server-Timing', `proxy;dur=${dur.toFixed(1)}`);
  if (isDev) {
    console.log(`[PERF:proxy] Refresh-path ${pathname}: ${dur.toFixed(1)}ms`);
  }

  return supabaseResponse;
}

export const middleware = proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (manifest, icons, sw.js)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js|css|woff|woff2)$).*)',
  ],
};
