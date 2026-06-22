import '../../../../../test/setup/integration-env';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationErrorCodes } from '@/lib/errors/invitation';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetInvitationTestData,
  seedInvitationTestFixtures,
} from '@/test/helpers/test-db';

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

const dbReady = await isTestDatabaseReady();

function mockAuthenticatedSession(userId: string, organizationId: string, email: string) {
  mockGetSession.mockResolvedValue({
    user: { id: userId, email },
    session: { activeOrganizationId: organizationId },
  });
}

function postInvitation(body: unknown, headers: Record<string, string> = {}) {
  return import('../route').then(({ POST }) =>
    POST(
      new Request('http://localhost:3000/api/organization/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      })
    )
  );
}

function getInvitations(headers: Record<string, string> = {}) {
  return import('../route').then(({ GET }) =>
    GET(
      new Request('http://localhost:3000/api/organization/invitations', {
        method: 'GET',
        headers,
      })
    )
  );
}

function deleteInvitation(id: string, headers: Record<string, string> = {}) {
  return import('../[id]/route').then(({ DELETE }) =>
    DELETE(
      new Request(`http://localhost:3000/api/organization/invitations/${id}`, {
        method: 'DELETE',
        headers,
      }),
      { params: Promise.resolve({ id }) }
    )
  );
}

describe('POST /api/organization/invitations', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 400 VALIDATION_ERROR for invalid email', async () => {
    const response = await postInvitation({
      email: 'not-an-email',
      role: 'member',
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.VALIDATION_ERROR);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for invalid role', async () => {
    const response = await postInvitation({
      email: 'agent@example.com',
      role: 'owner',
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.VALIDATION_ERROR);
  });

  it('returns 400 VALIDATION_ERROR for invalid JSON body', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/organization/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.VALIDATION_ERROR);
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await postInvitation({
      email: 'agent@example.com',
      role: 'member',
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('POST /api/organization/invitations (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetInvitationTestData(prisma);
  });

  it('returns 403 FORBIDDEN for non-admin members', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.member.id,
      fixtures.organizationId,
      fixtures.member.email
    );

    const response = await postInvitation({
      email: 'newagent@example.com',
      role: 'member',
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
  });

  it('creates a pending invitation for an owner', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const response = await postInvitation({
      email: 'New.Agent@Example.com',
      role: 'member',
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      email: 'new.agent@example.com',
      role: 'member',
      status: 'pending',
    });
    expect(body.data.id).toBeTruthy();
    expect(body.data.expiresAt).toBeTruthy();
    expect(body.data.createdAt).toBeTruthy();

    const stored = await prisma.invitation.findUnique({
      where: { id: body.data.id },
    });

    expect(stored).not.toBeNull();
    expect(stored?.organizationId).toBe(fixtures.organizationId);
    expect(stored?.inviterId).toBe(fixtures.owner.id);
    expect(stored?.status).toBe('pending');
  });

  it('creates a pending invitation for an admin', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.admin.id,
      fixtures.organizationId,
      fixtures.admin.email
    );

    const response = await postInvitation({
      email: 'admin-invite@example.com',
      role: 'admin',
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('admin');

    const stored = await prisma.invitation.findUnique({
      where: { id: body.data.id },
    });

    expect(stored?.inviterId).toBe(fixtures.admin.id);
  });

  it('returns 409 ALREADY_MEMBER when email belongs to an existing member', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const response = await postInvitation({
      email: fixtures.existingMember.email,
      role: 'member',
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(InvitationErrorCodes.ALREADY_MEMBER);
  });

  it('returns 409 INVITATION_ALREADY_PENDING for duplicate pending invites', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const first = await postInvitation({
      email: 'duplicate@example.com',
      role: 'member',
    });
    expect(first.status).toBe(200);

    const second = await postInvitation({
      email: 'duplicate@example.com',
      role: 'member',
    });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(InvitationErrorCodes.INVITATION_ALREADY_PENDING);
  });
});

describe('GET /api/organization/invitations', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await getInvitations();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('GET /api/organization/invitations (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetInvitationTestData(prisma);
  });

  it('returns 403 FORBIDDEN for non-admin members', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.member.id,
      fixtures.organizationId,
      fixtures.member.email
    );

    const response = await getInvitations();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
  });

  it('lists pending non-expired invitations for an admin', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.admin.id,
      fixtures.organizationId,
      fixtures.admin.email
    );

    const createResponse = await postInvitation({
      email: 'listed@example.com',
      role: 'member',
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();

    await prisma.invitation.create({
      data: {
        id: 'expired-invite-id',
        organizationId: fixtures.organizationId,
        email: 'expired@example.com',
        role: 'member',
        status: 'pending',
        expiresAt: new Date(Date.now() - 60_000),
        inviterId: fixtures.admin.id,
      },
    });

    await prisma.invitation.create({
      data: {
        id: 'revoked-invite-id',
        organizationId: fixtures.organizationId,
        email: 'revoked@example.com',
        role: 'member',
        status: 'revoked',
        expiresAt: new Date(Date.now() + 86_400_000),
        inviterId: fixtures.admin.id,
      },
    });

    const response = await getInvitations();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: created.data.id,
      email: 'listed@example.com',
      role: 'member',
      status: 'pending',
    });
  });
});

describe('DELETE /api/organization/invitations/[id]', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await deleteInvitation('some-id');

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('DELETE /api/organization/invitations/[id] (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetInvitationTestData(prisma);
  });

  it('returns 403 FORBIDDEN for non-admin members', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.member.id,
      fixtures.organizationId,
      fixtures.member.email
    );

    const response = await deleteInvitation('missing-id');

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
  });

  it('revokes a pending invitation for an owner', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const createResponse = await postInvitation({
      email: 'revoke-me@example.com',
      role: 'member',
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();

    const response = await deleteInvitation(created.data.id);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: created.data.id,
      email: 'revoke-me@example.com',
      status: 'revoked',
    });

    const stored = await prisma.invitation.findUnique({
      where: { id: created.data.id },
    });
    expect(stored?.status).toBe('revoked');
  });

  it('returns 404 INVITATION_NOT_FOUND for cross-tenant invitation id', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    const otherOrg = await seedInvitationTestFixtures(prisma, 'test-invite-other-org');

    const foreignInvitation = await prisma.invitation.create({
      data: {
        id: 'foreign-invite-id',
        organizationId: otherOrg.organizationId,
        email: 'foreign@example.com',
        role: 'member',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
        inviterId: otherOrg.owner.id,
      },
    });

    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const response = await deleteInvitation(foreignInvitation.id);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(InvitationErrorCodes.INVITATION_NOT_FOUND);

    const unchanged = await prisma.invitation.findUnique({
      where: { id: foreignInvitation.id },
    });
    expect(unchanged?.status).toBe('pending');
  });

  it('returns 409 INVITATION_NOT_REVOCABLE when invitation is already revoked', async () => {
    const fixtures = await seedInvitationTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const invitation = await prisma.invitation.create({
      data: {
        id: 'already-revoked-id',
        organizationId: fixtures.organizationId,
        email: 'already-revoked@example.com',
        role: 'member',
        status: 'revoked',
        expiresAt: new Date(Date.now() + 86_400_000),
        inviterId: fixtures.owner.id,
      },
    });

    const response = await deleteInvitation(invitation.id);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(InvitationErrorCodes.INVITATION_NOT_REVOCABLE);
  });
});

if (!dbReady) {
  console.warn(
    '[route] Test database not available — skipped DB-backed invitation tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
