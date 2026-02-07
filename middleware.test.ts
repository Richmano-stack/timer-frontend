import { describe, it, expect, vi } from 'vitest';
import { middleware } from './middleware';
import { NextRequest, NextResponse } from 'next/server';

// Mock NextResponse
vi.mock('next/server', async () => {
    const actual = await vi.importActual('next/server');
    return {
        ...actual,
        NextResponse: {
            next: vi.fn(() => ({ type: 'next' })),
            redirect: vi.fn((url) => ({ type: 'redirect', url })),
        },
    };
});

describe('Middleware', () => {
    const createRequest = (pathname: string, hasCookie = false) => {
        const url = new URL(`http://localhost:3000${pathname}`);

        // Create a mock of nextUrl that behaves like many properties of URL but has the .clone() method
        // We avoid spreading the URL object directly as it has internal properties and causes duplicate key warnings
        const nextUrl = {
            pathname: url.pathname,
            toString: () => url.toString(),
            clone: () => new URL(url.toString()),
            searchParams: url.searchParams,
        };

        return {
            nextUrl,
            cookies: {
                get: vi.fn().mockReturnValue(hasCookie ? { value: 'better-auth.session_token' } : undefined),
            },
        } as unknown as NextRequest;
    };

    it('allows public routes (login)', () => {
        const req = createRequest('/login');
        const res = middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
        expect(res).toEqual({ type: 'next' });
    });

    it('allows public routes (register)', () => {
        const req = createRequest('/register');
        const res = middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    it('allows static assets', () => {
        const req = createRequest('/image.png');
        const res = middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    it('allows Next.js internal paths', () => {
        const req = createRequest('/_next/static/chunks/main.js');
        const res = middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });

    it('redirects to /login if no session exists on protected route', () => {
        const req = createRequest('/dashboard');
        const res = middleware(req);

        expect(NextResponse.redirect).toHaveBeenCalled();
        const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0];
        expect(redirectUrl.pathname).toBe('/login');
        expect(redirectUrl.searchParams.get('from')).toBe('/dashboard');
    });

    it('allows access to protected route if session exists', () => {
        const req = createRequest('/dashboard', true);
        const res = middleware(req);
        expect(NextResponse.next).toHaveBeenCalled();
    });
});
