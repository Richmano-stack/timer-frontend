import '../../../../../test/setup/integration-env';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditAction, AuditTargetType } from '@/lib/db/audit';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetAuditLogTestData,
  seedAuditLogRows,
  seedAuditLogTestFixtures,
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

function getAuditLogs(search = '', headers: Record<string, string> = {}) {
  const url = `http://localhost:3000/api/organization/audit-logs${search}`;
  return import('../route').then(({ GET }) =>
    GET(
      new Request(url, {
        method: 'GET',
        headers,
      })
    )
  );
}

describe('GET /api/organization/audit-logs', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await getAuditLogs();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('GET /api/organization/audit-logs (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetAuditLogTestData(prisma);
  });

  it('returns 403 FORBIDDEN for non-admin members', async () => {
    const fixtures = await seedAuditLogTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.member.id,
      fixtures.organizationId,
      fixtures.member.email
    );

    const response = await getAuditLogs();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
  });

  it('lists audit logs scoped to the active organization', async () => {
    const tenantA = await seedAuditLogTestFixtures(prisma, 'test-audit-log-org-a');
    const tenantB = await seedAuditLogTestFixtures(prisma, 'test-audit-log-org-b');

    const invitationIdA = crypto.randomUUID();
    const invitationIdB = crypto.randomUUID();

    await seedAuditLogRows(prisma, {
      organizationId: tenantA.organizationId,
      actorUserId: tenantA.admin.id,
      rows: [
        {
          action: AuditAction.INVITATION_SENT,
          targetType: AuditTargetType.INVITATION,
          targetId: invitationIdA,
          metadata: { email: 'invitee-a@example.com', role: 'member' },
        },
        {
          action: AuditAction.JOIN_REQUEST_DENIED,
          targetType: AuditTargetType.JOIN_REQUEST,
          targetId: crypto.randomUUID(),
          metadata: { email: 'denied-a@example.com' },
        },
      ],
    });

    await seedAuditLogRows(prisma, {
      organizationId: tenantB.organizationId,
      actorUserId: tenantB.admin.id,
      rows: [
        {
          action: AuditAction.INVITATION_SENT,
          targetType: AuditTargetType.INVITATION,
          targetId: invitationIdB,
          metadata: { email: 'invitee-b@example.com', role: 'admin' },
        },
      ],
    });

    mockAuthenticatedSession(tenantA.admin.id, tenantA.organizationId, tenantA.admin.email);

    const response = await getAuditLogs();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data.every((row: { targetId: string }) => row.targetId !== invitationIdB)).toBe(
      true
    );
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      action: expect.any(String),
      targetType: expect.any(String),
      targetId: expect.any(String),
      actorUserId: tenantA.admin.id,
      actorEmail: tenantA.admin.email,
      createdAt: expect.any(String),
    });
    expect(body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('filters audit logs by action query parameter', async () => {
    const fixtures = await seedAuditLogTestFixtures(prisma);

    await seedAuditLogRows(prisma, {
      organizationId: fixtures.organizationId,
      actorUserId: fixtures.admin.id,
      rows: [
        {
          action: AuditAction.INVITATION_SENT,
          targetType: AuditTargetType.INVITATION,
          targetId: crypto.randomUUID(),
          metadata: { email: 'sent@example.com', role: 'member' },
        },
        {
          action: AuditAction.JOIN_REQUEST_DENIED,
          targetType: AuditTargetType.JOIN_REQUEST,
          targetId: crypto.randomUUID(),
          metadata: { email: 'denied@example.com' },
        },
      ],
    });

    mockAuthenticatedSession(fixtures.admin.id, fixtures.organizationId, fixtures.admin.email);

    const response = await getAuditLogs(
      `?action=${encodeURIComponent(AuditAction.JOIN_REQUEST_DENIED)}`
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].action).toBe(AuditAction.JOIN_REQUEST_DENIED);
  });
});

if (!dbReady) {
  console.warn(
    '[route] Test database not available — skipped DB-backed audit log tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
