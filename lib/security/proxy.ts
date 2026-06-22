import type { NextRequest } from 'next/server';
import { hasSessionCookie } from '@/lib/security/middleware-session';

export const PROTECTED_ROUTE_PREFIXES = [
  '/employee',
  '/admin',
  '/onboarding',
  '/billing',
] as const;

const ADMIN_ROUTE_PREFIX = '/admin';

export type ValidatedSession = {
  user: { id: string };
  session: { activeOrganizationId?: string | null };
};

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isAdminPath(pathname: string): boolean {
  return (
    pathname === ADMIN_ROUTE_PREFIX ||
    pathname.startsWith(`${ADMIN_ROUTE_PREFIX}/`)
  );
}

export function buildLoginRedirectUrl(
  request: NextRequest,
  pathname: string
): URL {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return loginUrl;
}

/**
 * Validates the Better Auth session against the get-session API.
 * Edge-safe: avoids importing lib/auth.ts (which pulls Prisma into the bundle).
 */
export async function fetchValidatedSession(
  request: NextRequest
): Promise<ValidatedSession | null> {
  const cookie = request.headers.get('cookie');
  if (!cookie) {
    return null;
  }

  try {
    const response = await fetch(new URL('/api/auth/get-session', request.url), {
      method: 'GET',
      headers: { cookie },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const session = (await response.json()) as ValidatedSession | null;
    if (!session?.user?.id) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function verifyProtectedRouteSession(
  request: NextRequest,
  pathname: string
): Promise<boolean> {
  if (isAdminPath(pathname)) {
    const session = await fetchValidatedSession(request);
    return session !== null;
  }

  return hasSessionCookie(request);
}
