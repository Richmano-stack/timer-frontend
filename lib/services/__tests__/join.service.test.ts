import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinErrorCodes } from '@/lib/errors/join';
import { ORG_ID, USER_ID } from '@/test/fixtures/time-log';

const { mockOrgFindUnique, mockOrgUpdate, mockMemberFindUnique, mockMemberCreate } = vi.hoisted(
  () => ({
    mockOrgFindUnique: vi.fn(),
    mockOrgUpdate: vi.fn(),
    mockMemberFindUnique: vi.fn(),
    mockMemberCreate: vi.fn(),
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
  },
}));

import {
  completeOrganizationJoin,
  getOrganizationBySlug,
  initializeJoinMetadata,
  updateJoinSettings,
  validateJoinEmail,
} from '@/lib/services/join.service';

const ORG_SLUG = 'acme-co';
const ORG_RECORD = {
  id: ORG_ID,
  name: 'Acme Co',
  slug: ORG_SLUG,
  metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
};

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
  beforeEach(() => {
    mockOrgFindUnique.mockResolvedValue(ORG_RECORD);
  });

  it('propagates validateJoinEmail failures without creating a member', async () => {
    const result = await completeOrganizationJoin(ORG_SLUG, USER_ID, 'user@gmail.com');

    expect(result.success).toBe(false);
    expect(mockMemberCreate).not.toHaveBeenCalled();
  });

  it('returns ALREADY_MEMBER when organizationId_userId already exists', async () => {
    mockMemberFindUnique.mockResolvedValue({ id: 'member-1' });

    const result = await completeOrganizationJoin(ORG_SLUG, USER_ID, 'user@acme.com');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(JoinErrorCodes.ALREADY_MEMBER);
    }
    expect(mockMemberCreate).not.toHaveBeenCalled();
  });

  it('creates member with role member on first join', async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    mockMemberCreate.mockResolvedValue({
      id: 'member-new',
      organizationId: ORG_ID,
    });

    const result = await completeOrganizationJoin(ORG_SLUG, USER_ID, 'user@acme.com');

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

  it('does not create member when validation fails mid-flow', async () => {
    mockOrgFindUnique.mockResolvedValue({
      ...ORG_RECORD,
      metadata: JSON.stringify({ allowedDomains: [] }),
    });

    await completeOrganizationJoin(ORG_SLUG, USER_ID, 'user@acme.com');

    expect(mockMemberCreate).not.toHaveBeenCalled();
  });

  it('resolves org by slug, not client-supplied organizationId', async () => {
    mockMemberFindUnique.mockResolvedValue(null);
    mockMemberCreate.mockResolvedValue({ id: 'member-new', organizationId: ORG_ID });

    await completeOrganizationJoin(ORG_SLUG, USER_ID, 'user@acme.com');

    expect(mockOrgFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: ORG_SLUG } })
    );
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

    const result = await updateJoinSettings(ORG_ID, [' @Beta.COM ', 'acme.com']);

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

    await updateJoinSettings(ORG_ID, ['acme.com', 'beta.com']);

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
