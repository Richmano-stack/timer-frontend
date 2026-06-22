import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  buildLoginRedirectUrl,
  isProtectedPath,
  verifyProtectedRouteSession,
} from '@/lib/security/proxy';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const isAuthenticated = await verifyProtectedRouteSession(request, pathname);

  if (!isAuthenticated) {
    return NextResponse.redirect(buildLoginRedirectUrl(request, pathname));
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
