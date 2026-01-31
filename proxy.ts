import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

const protectedRoutes = ['/dashboard', '/profile', '/history', '/analytics', '/team'];
const adminRoutes = ['/admin'];

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Static/Internal Exclusions
    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/static/') ||
        pathname.includes('.') ||
        pathname === '/favicon.ico'
    ) {
        return NextResponse.next();
    }
    console.log(`[Proxy] Checking AUTH for path: ${pathname}`);

    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

    if (!isProtectedRoute && !isAdminRoute) {
        return NextResponse.next();
    }

    try {
        const cookie = request.headers.get('cookie') || '';
        const authHeader = request.headers.get('authorization') || '';

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-better-auth-client': 'next-js'
        };

        if (cookie) headers.Cookie = cookie;
        if (authHeader) headers.Authorization = authHeader;

        const sessionResponse = await fetch(`${API_URL}/api/auth/get-session`, {
            headers,
            cache: 'no-store'
        });

        if (!sessionResponse.ok) {
            console.log(`[Proxy] Auth failed with status: ${sessionResponse.status}`);
            return redirectToLogin(request, pathname);
        }

        const sessionData = await sessionResponse.json();
        console.log(`[Proxy] Session Data Keys: ${Object.keys(sessionData).join(', ')}`);
        const user = sessionData?.user;

        if (!user) {
            console.log(`[Proxy] Session valid but user missing. Redirecting.`);
            return redirectToLogin(request, pathname);
        }

        if (isAdminRoute) {
            const userRole = user.role || 'user';
            if (userRole !== 'admin' && userRole !== 'supervisor') {
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }

        return NextResponse.next();
    } catch (error) {
        console.error('Middleware Auth Check Failed:', error);
        return redirectToLogin(request, pathname);
    }
}

function redirectToLogin(request: NextRequest, pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
}