import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

// Define route protections
const protectedRoutes = ['/dashboard', '/profile', '/status'];
const adminRoutes = ['/admin'];
const publicRoutes = ['/login', '/register', '/'];

export default async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    console.log(`[Proxy] Request for ${pathname}`);

    // Skip static files and api routes (if any internal ones)
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.includes('.') // files like favicon.ico
    ) {
        return NextResponse.next();
    }

    // Check if route requires auth
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

    if (!isProtectedRoute && !isAdminRoute) {
        return NextResponse.next();
    }

    // Verify authentication by calling the backend
    try {
        const cookie = request.headers.get('cookie') || '';
        const authHeader = request.headers.get('authorization') || '';

        console.log(`[Proxy] Checking auth for ${pathname}`);
        if (cookie) {
            const names = cookie.split(';').map(c => c.split('=')[0].trim());
            console.log(`[Proxy] Cookies present: ${names.join(', ')}`);
        } else {
            console.log(`[Proxy] No cookies present`);
        }
        if (authHeader) {
            console.log(`[Proxy] Authorization header present: ${authHeader.substring(0, 20)}...`);
        }

        const urlMe = `${API_URL}/api/auth/me`;
        const urlSession = `${API_URL}/api/auth/session`;
        console.log(`[Proxy] Trying ${urlMe} and ${urlSession}`);

        // Build headers object with both Cookie and Authorization if available
        const headers: Record<string, string> = {};
        if (cookie) headers.Cookie = cookie;
        if (authHeader) headers.Authorization = authHeader;

        const [resMe, resSession] = await Promise.all([
            fetch(urlMe, { headers }),
            fetch(urlSession, { headers })
        ]);

        console.log(`[Proxy] /me status: ${resMe.status}, /session status: ${resSession.status}`);

        let user = null;
        if (resMe.ok) {
            user = await resMe.json();
            console.log(`[Proxy] /me response: ${JSON.stringify(user).substring(0, 50)}...`);
        } else if (resSession.ok) {
            const session = await resSession.json();
            console.log(`[Proxy] /session response: ${JSON.stringify(session).substring(0, 50)}...`);
            user = session.user;
        }

        if (!user || Object.keys(user).length === 0) {
            console.log(`[Proxy] No user found in response. Redirecting to login from ${pathname}`);
            // If unauthorized, redirect to login
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('from', pathname);
            return NextResponse.redirect(url);
        }

        // Check Admin Role
        if (isAdminRoute) {
            if (user.role !== 'admin' && user.role !== 'supervisor') {
                // Redirect to dashboard if not authorized
                return NextResponse.redirect(new URL('/dashboard', request.url));
            }
        }

        return NextResponse.next();
    } catch (error) {
        console.error('Middleware Auth Check Failed:', error);
        // On error (e.g. backend down), redirect to login or show error?
        // Safer to redirect to login
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
