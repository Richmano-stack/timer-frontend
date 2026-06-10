import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkJoinMagicLinkRateLimit,
  getJoinRateLimitConfig,
  resetJoinRateLimitsForTests,
} from '@/lib/security/join-rate-limit';

describe('checkJoinMagicLinkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
    resetJoinRateLimitsForTests();
  });

  afterEach(() => {
    resetJoinRateLimitsForTests();
    vi.useRealTimers();
  });

  it('allows requests within IP and email limits', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    const config = getJoinRateLimitConfig();

    for (let index = 0; index < config.emailLimit; index += 1) {
      const result = checkJoinMagicLinkRateLimit(request, `agent${index}@join-test.local`);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks further requests for the same email', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });
    const email = 'repeat@join-test.local';
    const config = getJoinRateLimitConfig();

    for (let index = 0; index < config.emailLimit; index += 1) {
      expect(checkJoinMagicLinkRateLimit(request, email).allowed).toBe(true);
    }

    const blocked = checkJoinMagicLinkRateLimit(request, email);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('email');
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('blocks further requests from the same IP across different emails', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.12' },
    });
    const config = getJoinRateLimitConfig();

    for (let index = 0; index < config.ipLimit; index += 1) {
      expect(checkJoinMagicLinkRateLimit(request, `user${index}@join-test.local`).allowed).toBe(
        true
      );
    }

    const blocked = checkJoinMagicLinkRateLimit(request, 'another@join-test.local');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('ip');
    }
  });
});
