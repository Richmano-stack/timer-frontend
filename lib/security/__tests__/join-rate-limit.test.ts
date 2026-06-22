import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkInviteCreationRateLimit,
  checkJoinMagicLinkRateLimit,
  checkJoinRequestRateLimit,
  getInviteRateLimitConfig,
  getJoinRateLimitConfig,
  getJoinRequestRateLimitConfig,
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

describe('checkInviteCreationRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
    resetJoinRateLimitsForTests();
  });

  afterEach(() => {
    resetJoinRateLimitsForTests();
    vi.useRealTimers();
  });

  it('allows requests within org, IP, and actor limits', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.20' },
    });
    const config = getInviteRateLimitConfig();

    for (let index = 0; index < config.orgLimit; index += 1) {
      const result = checkInviteCreationRateLimit(
        request,
        'actor-user-1',
        'org-1'
      );
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks further invitations for the same organization', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.21' },
    });
    const config = getInviteRateLimitConfig();

    for (let index = 0; index < config.orgLimit; index += 1) {
      expect(
        checkInviteCreationRateLimit(request, `actor-${index}`, 'org-blocked').allowed
      ).toBe(true);
    }

    const blocked = checkInviteCreationRateLimit(request, 'actor-new', 'org-blocked');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('org');
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('blocks further invitations from the same actor across organizations', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.22' },
    });
    const config = getInviteRateLimitConfig();

    for (let index = 0; index < config.actorLimit; index += 1) {
      expect(
        checkInviteCreationRateLimit(request, 'actor-spam', `org-${index}`).allowed
      ).toBe(true);
    }

    const blocked = checkInviteCreationRateLimit(request, 'actor-spam', 'org-extra');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('actor');
    }
  });

  it('blocks further invitations from the same IP across actors and organizations', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.23' },
    });
    const config = getInviteRateLimitConfig();

    for (let index = 0; index < config.ipLimit; index += 1) {
      expect(
        checkInviteCreationRateLimit(request, `actor-${index}`, `org-${index}`).allowed
      ).toBe(true);
    }

    const blocked = checkInviteCreationRateLimit(request, 'actor-extra', 'org-extra');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('ip');
    }
  });
});

describe('checkJoinRequestRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
    resetJoinRateLimitsForTests();
  });

  afterEach(() => {
    resetJoinRateLimitsForTests();
    vi.useRealTimers();
  });

  it('allows requests within IP, email, and org limits', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.30' },
    });
    const config = getJoinRequestRateLimitConfig();

    for (let index = 0; index < config.emailLimit; index += 1) {
      const result = checkJoinRequestRateLimit(
        request,
        `agent${index}@join-test.local`,
        'demo-company'
      );
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks further join requests for the same email', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.31' },
    });
    const email = 'repeat@join-test.local';
    const config = getJoinRequestRateLimitConfig();

    for (let index = 0; index < config.emailLimit; index += 1) {
      expect(checkJoinRequestRateLimit(request, email, 'demo-company').allowed).toBe(true);
    }

    const blocked = checkJoinRequestRateLimit(request, email, 'demo-company');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('email');
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('blocks further join requests from the same IP across different emails', () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.32' },
    });
    const config = getJoinRequestRateLimitConfig();

    for (let index = 0; index < config.ipLimit; index += 1) {
      expect(
        checkJoinRequestRateLimit(request, `user${index}@join-test.local`, 'demo-company').allowed
      ).toBe(true);
    }

    const blocked = checkJoinRequestRateLimit(request, 'another@join-test.local', 'demo-company');
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('ip');
    }
  });

  it('blocks further join requests for the same organization slug', () => {
    const config = getJoinRequestRateLimitConfig();

    for (let index = 0; index < config.orgLimit; index += 1) {
      const request = new Request('http://localhost', {
        headers: { 'x-forwarded-for': `203.0.113.${index + 40}` },
      });
      expect(
        checkJoinRequestRateLimit(
          request,
          `user${index}@join-test.local`,
          'flooded-org'
        ).allowed
      ).toBe(true);
    }

    const blockedRequest = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.99' },
    });
    const blocked = checkJoinRequestRateLimit(
      blockedRequest,
      'fresh@join-test.local',
      'flooded-org'
    );
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.scope).toBe('org');
    }
  });
});
