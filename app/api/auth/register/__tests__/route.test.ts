import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthErrorCodes } from '@/lib/errors/auth';

const mockSignUpEmail = vi.hoisted(() =>
  vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        token: 'session-token',
        user: { id: 'user-1', email: 'owner@example.com', name: 'Owner' },
      }),
      { status: 200, headers: { 'Set-Cookie': 'session=abc; Path=/' } }
    )
  )
);

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signUpEmail: mockSignUpEmail,
    },
  },
}));

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    mockSignUpEmail.mockClear();
  });

  it('returns 400 for invalid payloads', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const response = await POST(
      new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'owner_bootstrap',
          name: '',
          email: 'not-an-email',
          password: 'short',
        }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(AuthErrorCodes.VALIDATION_ERROR);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it('creates an owner account through Better Auth', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const response = await POST(
      new Request('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'owner_bootstrap',
          name: 'Owner User',
          email: 'owner@example.com',
          password: 'SecurePass1!',
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('owner@example.com');
    expect(mockSignUpEmail).toHaveBeenCalledOnce();
    expect(response.headers.get('set-cookie')).toContain('session=abc');
  });
});
