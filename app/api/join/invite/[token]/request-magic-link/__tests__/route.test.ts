import '@/test/setup/integration-env';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinErrorCodes } from '@/lib/errors/join';
import { resetJoinRateLimitsForTests } from '@/lib/security/join-rate-limit';
import {
  createJoinTestInviter,
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetJoinTestData,
  seedJoinTestInvitation,
  seedJoinTestOrganization,
} from '@/test/helpers/test-db';
import { serializeOrganizationMetadata } from '@/lib/organization/metadata';

const mockSignInMagicLink = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signInMagicLink: mockSignInMagicLink,
    },
  },
}));

const VALID_TOKEN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const dbReady = await isTestDatabaseReady();

describe('POST /api/join/invite/[token]/request-magic-link', () => {
  beforeEach(() => {
    mockSignInMagicLink.mockClear();
    resetJoinRateLimitsForTests();
  });

  it('returns 400 VALIDATION_ERROR for invalid token format', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/invite/not-a-uuid/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invited@join-test.local' }),
      }),
      { params: Promise.resolve({ token: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.VALIDATION_ERROR);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for invalid email', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request(`http://localhost:3000/api/join/invite/${VALID_TOKEN}/request-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.VALIDATION_ERROR);
  });
});

describe.skipIf(!dbReady)('POST /api/join/invite/[token]/request-magic-link (database)', () => {
  const prisma = getTestPrisma();
  const ORG_SLUG = 'test-join-invite-route';

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockSignInMagicLink.mockClear();
    resetJoinRateLimitsForTests();
    await resetJoinTestData(prisma);
    await seedJoinTestOrganization(prisma, ORG_SLUG);
  });

  it('returns 404 INVITATION_NOT_FOUND for unknown token', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request(`http://localhost:3000/api/join/invite/${VALID_TOKEN}/request-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invited@join-test.local' }),
      }),
      { params: Promise.resolve({ token: VALID_TOKEN }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe(JoinErrorCodes.INVITATION_NOT_FOUND);
  });

  it('returns 403 INVITATION_EMAIL_MISMATCH for wrong email', async () => {
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'invited@join-test.local',
      id: VALID_TOKEN,
    });

    const { POST } = await import('../route');

    const response = await POST(
      new Request(`http://localhost:3000/api/join/invite/${invitation.id}/request-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'other@join-test.local' }),
      }),
      { params: Promise.resolve({ token: invitation.id }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe(JoinErrorCodes.INVITATION_EMAIL_MISMATCH);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });

  it('returns 200 and triggers signInMagicLink for valid invitation', async () => {
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'invited@join-test.local',
      id: VALID_TOKEN,
    });

    const { POST } = await import('../route');

    const response = await POST(
      new Request(`http://localhost:3000/api/join/invite/${invitation.id}/request-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invited@join-test.local' }),
      }),
      { params: Promise.resolve({ token: invitation.id }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationName).toBe('Join Test Org');
    expect(mockSignInMagicLink).toHaveBeenCalledOnce();
    expect(mockSignInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: 'invited@join-test.local',
          callbackURL: `http://localhost:3000/join/invite/${invitation.id}/complete`,
          metadata: expect.objectContaining({
            invitationToken: invitation.id,
            organizationId: org.id,
            orgSlug: ORG_SLUG,
          }),
        }),
      })
    );
  });

  it('returns 403 DOMAIN_NOT_ALLOWED when invitation email domain is outside org allowlist', async () => {
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        metadata: serializeOrganizationMetadata({ allowedDomains: ['corp-only.example'] }),
      },
    });
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'invited@join-test.local',
      id: VALID_TOKEN,
    });

    const { POST } = await import('../route');

    const response = await POST(
      new Request(`http://localhost:3000/api/join/invite/${invitation.id}/request-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invited@join-test.local' }),
      }),
      { params: Promise.resolve({ token: invitation.id }) }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe(JoinErrorCodes.DOMAIN_NOT_ALLOWED);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });
});

if (!dbReady) {
  console.warn(
    '[route] Test database not available — skipped DB-backed invite request-magic-link tests.'
  );
}
