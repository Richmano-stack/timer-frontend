import { NextRequest, NextResponse } from 'next/server';
import { hasSessionCookie } from '@/lib/security/middleware-session';

const PROTECTED_PREFIXES = ['/employee', '/admin', '/onboarding', '/billing'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(request)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/employee/:path*',
    '/admin/:path*',
    '/onboarding',
    '/billing/:path*',
  ],
};
