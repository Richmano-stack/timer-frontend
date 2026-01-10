import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Define route protections
const protectedRoutes = ['/dashboard', '/profile', '/status'];
const adminRoutes = ['/admin'];
const publicRoutes = ['/login', '/register', '/'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

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
        const authResponse = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
                // Forward cookies from the incoming request
                Cookie: request.headers.get('cookie') || '',
            },
        });

        if (!authResponse.ok) {
            // If unauthorized, redirect to login
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('from', pathname);
            return NextResponse.redirect(url);
        }

        const user = await authResponse.json();

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
