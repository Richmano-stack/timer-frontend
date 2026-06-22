import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinErrorCodes } from '@/lib/errors/join';
import { ORG_ID, USER_ID } from '@/test/fixtures/time-log';

const { mockOrgFindUnique, mockOrgUpdate, mockMemberFindUnique, mockMemberCreate, mockInvitationFindUnique, mockJoinRequestFindFirst } = vi.hoisted(
  () => ({
    mockOrgFindUnique: vi.fn(),
    mockOrgUpdate: vi.fn(),
    mockMemberFindUnique: vi.fn(),
    mockMemberCreate: vi.fn(),
    mockInvitationFindUnique: vi.fn(),
    mockJoinRequestFindFirst: vi.fn(),
  })
);

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    organization: {
      findUnique: mockOrgFindUnique,
      update: mockOrgUpdate,
    },
    member: {
      findUnique: mockMemberFindUnique,
      create: mockMemberCreate,
    },
    invitation: {
      findUnique: mockInvitationFindUnique,
    },
    joinRequest: {
      findFirst: mockJoinRequestFindFirst,
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        joinRequest: { findFirst: mockJoinRequestFindFirst, update: vi.fn() },
        member: { create: mockMemberCreate },
      })
    ),
  },
}));

import {
  completeInvitationJoin,
  completeJoinWithApprovedRequest,
  completeOrganizationJoin,
  getOrganizationBySlug,
  initializeJoinMetadata,
  updateJoinSettings,
  validateInvitationForJoin,
  validateJoinEmail,
} from '@/lib/services/join.service';

const ORG_SLUG = 'acme-co';
const ORG_RECORD = {
  id: ORG_ID,
  name: 'Acme Co',
  slug: ORG_SLUG,
  metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
};

const INVITE_TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FUTURE_EXPIRY = new Date(Date.now() + 86_400_000);

function buildPendingInvitation(overrides: {
  email?: string;
  metadata?: string | null;
  status?: string;
  expiresAt?: Date;
} = {}) {
  return {
    id: INVITE_TOKEN,
    email: overrides.email ?? 'agent@acme.com',
    role: 'member',
    status: overrides.status ?? 'pending',
    expiresAt: overrides.expiresAt ?? FUTURE_EXPIRY,
    organizationId: ORG_ID,
    organization: {
      id: ORG_ID,
      name: 'Acme Co',
      slug: ORG_SLUG,
      metadata: overrides.metadata ?? ORG_RECORD.metadata,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateJoinEmail', () => {
  it('returns ORGANIZATION_NOT_FOUND for unknown orgSlug', async () => {
    mockOrgFindUnique.mockResolvedValue(null);

    const result = await validateJoinEmail('missing-slug', 'user@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.ORGANIZATION_NOT_FOUND);
    }
  });

  it('returns NO_ALLOWED_DOMAINS when metadata has empty allowedDomains', async () => {
    mockOrgFindUnique.mockResolvedValue({
      ...ORG_RECORD,
      metadata: JSON.stringify({ allowedDomains: [] }),
    });

    const result = await validateJoinEmail(ORG_SLUG, 'user@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.NO_ALLOWED_DOMAINS);
    }
  });

  it('returns DOMAIN_NOT_ALLOWED for email outside allowlist', async () => {
    mockOrgFindUnique.mockResolvedValue(ORG_RECORD);

    const result = await validateJoinEmail(ORG_SLUG, 'user@gmail.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.DOMAIN_NOT_ALLOWED);
    }
  });

  it('accepts email when domain matches after normalizeDomain (@ prefix, casing)', async () => {
    mockOrgFindUnique.mockResolvedValue({
      ...ORG_RECORD,
      metadata: JSON.stringify({ allowedDomains: ['@ACME.com'] }),
    });

    const result = await validateJoinEmail(ORG_SLUG, 'User@acme.com');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organizationId).toBe(ORG_ID);
    }
  });

  it('rejects subdomain spoofing (user@evil-acme.com vs allowed acme.com)', async () => {
    mockOrgFindUnique.mockResolvedValue(ORG_RECORD);

    const result = await validateJoinEmail(ORG_SLUG, 'user@evil-acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.DOMAIN_NOT_ALLOWED);
    }
  });

  it('returns organizationId and name on happy path', async () => {
    mockOrgFindUnique.mockResolvedValue(ORG_RECORD);

    const result = await validateJoinEmail(ORG_SLUG, 'agent@acme.com');

    expect(result).toEqual({
      success: true,
      data: { organizationId: ORG_ID, organizationName: 'Acme Co' },
    });
  });
});

describe('completeOrganizationJoin', () => {
  it('rejects domain-only slug join with INVITATION_REQUIRED', async () => {
    const result = await completeOrganizationJoin(ORG_SLUG, USER_ID, 'user@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.INVITATION_REQUIRED);
    }
    expect(mockMemberCreate).not.toHaveBeenCalled();
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });
});

describe('completeJoinWithApprovedRequest', () => {
  it('returns JOIN_REQUEST_NOT_APPROVED when no approved request exists', async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    mockJoinRequestFindFirst.mockResolvedValue(null);

    const result = await completeJoinWithApprovedRequest(ORG_ID, USER_ID, 'user@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.JOIN_REQUEST_NOT_APPROVED);
    }
    expect(mockMemberCreate).not.toHaveBeenCalled();
  });

  it('returns ALREADY_MEMBER when organizationId_userId already exists', async () => {
    mockMemberFindUnique.mockResolvedValue({ id: 'member-1' });

    const result = await completeJoinWithApprovedRequest(ORG_ID, USER_ID, 'user@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.ALREADY_MEMBER);
    }
    expect(mockMemberCreate).not.toHaveBeenCalled();
  });

  it('creates member when an approved join request exists', async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    mockJoinRequestFindFirst.mockResolvedValue({ id: 'jr-1', userId: USER_ID });
    mockMemberCreate.mockResolvedValue({
      id: 'member-new',
      organizationId: ORG_ID,
    });

    const result = await completeJoinWithApprovedRequest(ORG_ID, USER_ID, 'user@acme.com');

    expect(result.success).toBe(true);
    expect(mockMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          userId: USER_ID,
          role: 'member',
        }),
      })
    );
    if (result.success) {
      expect(result.data.memberId).toBe('member-new');
    }
  });

  it('returns ALREADY_MEMBER when member.create races and throws P2002', async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    mockJoinRequestFindFirst.mockResolvedValue({ id: 'jr-1', userId: USER_ID });
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' }
    );
    mockMemberCreate.mockRejectedValue(uniqueViolation);

    const result = await completeJoinWithApprovedRequest(ORG_ID, USER_ID, 'user@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.ALREADY_MEMBER);
    }
  });
});

describe('initializeJoinMetadata', () => {
  it('is idempotent when allowedDomains already configured', async () => {
    mockOrgFindUnique.mockResolvedValue({
      id: ORG_ID,
      metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
    });

    const result = await initializeJoinMetadata(ORG_ID, 'owner@other.com');

    expect(result.success).toBe(true);
    expect(mockOrgUpdate).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.data.allowedDomains).toEqual(['acme.com']);
    }
  });

  it('seeds allowedDomains from owner email domain on first bootstrap', async () => {
    mockOrgFindUnique.mockResolvedValue({ id: ORG_ID, metadata: null });
    mockOrgUpdate.mockResolvedValue({ id: ORG_ID });

    const result = await initializeJoinMetadata(ORG_ID, 'owner@acme.com');

    expect(result.success).toBe(true);
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
        },
      })
    );
    if (result.success) {
      expect(result.data.allowedDomains).toEqual(['acme.com']);
    }
  });

  it('returns ORGANIZATION_NOT_FOUND for invalid organizationId', async () => {
    mockOrgFindUnique.mockResolvedValue(null);

    const result = await initializeJoinMetadata('missing-org', 'owner@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.ORGANIZATION_NOT_FOUND);
    }
  });
});

describe('updateJoinSettings', () => {
  it('persists normalized domains via serializeOrganizationMetadata', async () => {
    mockOrgFindUnique.mockResolvedValue({
      ...ORG_RECORD,
      metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
    });
    mockOrgUpdate.mockResolvedValue({ id: ORG_ID });

    const result = await updateJoinSettings(ORG_ID, {
      allowedDomains: [' @Beta.COM ', 'acme.com'],
    });

    expect(result.success).toBe(true);
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          metadata: JSON.stringify({ allowedDomains: ['beta.com', 'acme.com'] }),
        },
      })
    );
    if (result.success) {
      expect(result.data.allowedDomains).toEqual([' @Beta.COM ', 'acme.com']);
    }
  });

  it('does not wipe org when patching allowedDomains', async () => {
    mockOrgFindUnique.mockResolvedValue({
      ...ORG_RECORD,
      metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
    });
    mockOrgUpdate.mockResolvedValue({ id: ORG_ID });

    await updateJoinSettings(ORG_ID, { allowedDomains: ['acme.com', 'beta.com'] });

    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ORG_ID },
      })
    );
    expect(mockOrgFindUnique).toHaveBeenCalled();
  });
});

describe('getOrganizationBySlug', () => {
  it('returns allowedDomains from parsed metadata', async () => {
    mockOrgFindUnique.mockResolvedValue(ORG_RECORD);

    const result = await getOrganizationBySlug(ORG_SLUG);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.allowedDomains).toEqual(['acme.com']);
    }
  });
});

describe('validateInvitationForJoin', () => {
  it('returns DOMAIN_NOT_ALLOWED when org allowlist excludes invitation email domain', async () => {
    mockInvitationFindUnique.mockResolvedValue(
      buildPendingInvitation({
        email: 'agent@gmail.com',
        metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
      })
    );

    const result = await validateInvitationForJoin(INVITE_TOKEN, 'agent@gmail.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.DOMAIN_NOT_ALLOWED);
    }
  });

  it('accepts invitation when email domain matches allowlist after normalization', async () => {
    mockInvitationFindUnique.mockResolvedValue(
      buildPendingInvitation({
        email: 'Agent@ACME.com',
        metadata: JSON.stringify({ allowedDomains: ['@acme.com'] }),
      })
    );

    const result = await validateInvitationForJoin(INVITE_TOKEN, 'Agent@ACME.com');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organizationId).toBe(ORG_ID);
    }
  });

  it('skips domain check when allowedDomains is empty', async () => {
    mockInvitationFindUnique.mockResolvedValue(
      buildPendingInvitation({
        email: 'agent@gmail.com',
        metadata: JSON.stringify({ allowedDomains: [] }),
      })
    );

    const result = await validateInvitationForJoin(INVITE_TOKEN, 'agent@gmail.com');

    expect(result.success).toBe(true);
  });

  it('returns INVITATION_EMAIL_MISMATCH before domain check', async () => {
    mockInvitationFindUnique.mockResolvedValue(buildPendingInvitation());

    const result = await validateInvitationForJoin(INVITE_TOKEN, 'other@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.INVITATION_EMAIL_MISMATCH);
    }
  });
});

describe('completeInvitationJoin', () => {
  it('propagates DOMAIN_NOT_ALLOWED without creating a member', async () => {
    mockInvitationFindUnique.mockResolvedValue(
      buildPendingInvitation({
        email: 'agent@gmail.com',
        metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
      })
    );

    const result = await completeInvitationJoin(INVITE_TOKEN, USER_ID, 'agent@gmail.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.DOMAIN_NOT_ALLOWED);
    }
    expect(mockMemberFindUnique).not.toHaveBeenCalled();
  });
});
