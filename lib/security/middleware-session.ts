import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
] as const;

/**
 * Edge-safe session presence check for middleware.
 * Avoid importing lib/auth.ts here — that pulls Prisma/kysely into the Edge bundle.
 */
export function hasSessionCookie(request: NextRequest): boolean {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = request.cookies.get(name)?.value;
    if (value) return true;
  }

  return false;
}
