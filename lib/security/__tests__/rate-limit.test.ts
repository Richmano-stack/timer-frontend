import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixedWindowRateLimiter, getClientIp } from '@/lib/security/rate-limit';

describe('createFixedWindowRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests up to the configured limit', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.check('key').allowed).toBe(true);
    expect(limiter.check('key').allowed).toBe(true);
    expect(limiter.check('key').allowed).toBe(true);
    expect(limiter.check('key').allowed).toBe(false);
  });

  it('resets the window after windowMs elapses', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 60_000 });

    expect(limiter.check('key').allowed).toBe(true);
    expect(limiter.check('key').allowed).toBe(true);
    expect(limiter.check('key').allowed).toBe(false);

    vi.advanceTimersByTime(60_000);

    expect(limiter.check('key').allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
  });
});

describe('getClientIp', () => {
  it('prefers the first x-forwarded-for address', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
    });

    expect(getClientIp(request)).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.4' },
    });

    expect(getClientIp(request)).toBe('198.51.100.4');
  });

  it('returns unknown when no proxy headers are present', () => {
    expect(getClientIp(new Request('http://localhost'))).toBe('unknown');
  });
});
