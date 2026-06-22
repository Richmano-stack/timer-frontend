import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRegistrationPermitsForTests,
  consumeRegistrationPermit,
  grantRegistrationPermit,
  hasActiveRegistrationPermit,
} from '@/lib/auth/registration-permit';
import {
  assertRegistrationAllowed,
  isOwnerOAuthCallbackURL,
} from '@/lib/auth/registration-policy';

vi.mock('@/lib/services/join.service', () => ({
  validateInvitationForJoin: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    invitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { validateInvitationForJoin } from '@/lib/services/join.service';
import { prisma } from '@/lib/db/prisma';

const mockValidateInvitationForJoin = vi.mocked(validateInvitationForJoin);
const mockFindFirst = vi.mocked(prisma.invitation.findFirst);
const mockFindUnique = vi.mocked(prisma.invitation.findUnique);

describe('registration-permit', () => {
  beforeEach(() => {
    clearRegistrationPermitsForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('grants and consumes a permit for the same email', () => {
    grantRegistrationPermit('owner@example.com', 'owner_bootstrap');

    expect(hasActiveRegistrationPermit('owner@example.com')).toBe(true);
    expect(consumeRegistrationPermit('owner@example.com')).toBe(true);
    expect(hasActiveRegistrationPermit('owner@example.com')).toBe(false);
  });

  it('expires permits after the ttl', () => {
    grantRegistrationPermit('owner@example.com', 'owner_bootstrap', 1_000);

    vi.advanceTimersByTime(1_001);

    expect(hasActiveRegistrationPermit('owner@example.com')).toBe(false);
    expect(consumeRegistrationPermit('owner@example.com')).toBe(false);
  });
});

describe('registration-policy', () => {
  beforeEach(() => {
    mockValidateInvitationForJoin.mockReset();
    mockFindFirst.mockReset();
    mockFindUnique.mockReset();
  });

  it('allows owner bootstrap registration', async () => {
    const result = await assertRegistrationAllowed('owner@example.com', 'owner_bootstrap');

    expect(result.success).toBe(true);
  });

  it('requires an invitation token for invitation intent', async () => {
    const result = await assertRegistrationAllowed('agent@example.com', 'invitation');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVITATION_REQUIRED');
    }
  });

  it('rejects invitation registration when validation fails', async () => {
    mockValidateInvitationForJoin.mockResolvedValue({
      success: false,
      error: { code: 'INVITATION_NOT_FOUND', message: 'Invalid invite.' },
    });

    const result = await assertRegistrationAllowed(
      'agent@example.com',
      'invitation',
      'invite-token'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVITATION_INVALID');
    }
  });

  it('accepts invitation registration when validation succeeds', async () => {
    mockValidateInvitationForJoin.mockResolvedValue({
      success: true,
      data: {
        invitationId: 'invite-token',
        organizationId: 'org-1',
        organizationName: 'Demo',
        organizationSlug: 'demo',
        role: 'member',
      },
    });
    mockFindUnique.mockResolvedValue({
      status: 'pending',
      expiresAt: new Date('2026-07-01T12:00:00.000Z'),
    } as never);

    const result = await assertRegistrationAllowed(
      'agent@example.com',
      'invitation',
      'invite-token'
    );

    expect(result.success).toBe(true);
  });
});

describe('isOwnerOAuthCallbackURL', () => {
  it('accepts the owner register callback URL', () => {
    expect(isOwnerOAuthCallbackURL('/auth/callback')).toBe(true);
  });

  it('rejects login callbacks that include a next path', () => {
    expect(isOwnerOAuthCallbackURL('/auth/callback?next=/employee/track')).toBe(false);
  });
});
