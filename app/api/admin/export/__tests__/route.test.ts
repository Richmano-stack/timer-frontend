import '../../../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { AuditAction, AuditTargetType } from '@/lib/db/audit';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetTenantIsolationTestData,
  seedAuditLogRows,
  seedTenantIsolationFixtures,
  type TenantIsolationFixtures,
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

function getExport(search = '') {
  const url = `http://localhost:3000/api/admin/export${search}`;
  return import('../route').then(({ GET }) =>
    GET(
      new Request(url, {
        method: 'GET',
      })
    )
  );
}

function unzipExport(buffer: ArrayBuffer): Record<string, string> {
  const files = unzipSync(new Uint8Array(buffer));
  const decoded: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) {
    decoded[name] = strFromU8(data);
  }
  return decoded;
}

describe('GET /api/admin/export', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await getExport();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('GET /api/admin/export (database)', () => {
  const prisma = getTestPrisma();
  let fixtures: TenantIsolationFixtures;

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetTenantIsolationTestData(prisma);
    await prisma.auditLog.deleteMany({
      where: {
        organization: { slug: { startsWith: 'test-isolation-tenant-' } },
      },
    });
    fixtures = await seedTenantIsolationFixtures(prisma);
  });

  afterAll(async () => {
    await resetTenantIsolationTestData(prisma);
    await prisma.auditLog.deleteMany({
      where: {
        organization: { slug: { startsWith: 'test-isolation-tenant-' } },
      },
    });
    await prisma.$disconnect();
  });

  it('returns 403 FORBIDDEN for non-admin members', async () => {
    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const response = await getExport();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
  });

  it('returns a zip archive scoped to the active organization only', async () => {
    const tenantATime = new Date('2025-06-01T10:00:00.000Z');
    const tenantBTime = new Date('2025-06-01T11:00:00.000Z');

    await prisma.timeLog.create({
      data: {
        userId: fixtures.tenantA.member.id,
        organizationId: fixtures.tenantA.organizationId,
        activityStatusId: fixtures.tenantA.availableStatusId,
        startTime: tenantATime,
        endTime: new Date('2025-06-01T18:00:00.000Z'),
      },
    });

    await prisma.timeLog.create({
      data: {
        userId: fixtures.tenantB.member.id,
        organizationId: fixtures.tenantB.organizationId,
        activityStatusId: fixtures.tenantB.availableStatusId,
        startTime: tenantBTime,
        endTime: new Date('2025-06-01T19:00:00.000Z'),
      },
    });

    await seedAuditLogRows(prisma, {
      organizationId: fixtures.tenantA.organizationId,
      actorUserId: fixtures.tenantA.admin.id,
      rows: [
        {
          action: AuditAction.INVITATION_SENT,
          targetType: AuditTargetType.INVITATION,
          targetId: crypto.randomUUID(),
          metadata: { email: 'invitee-a@example.com', role: 'member' },
        },
      ],
    });

    await seedAuditLogRows(prisma, {
      organizationId: fixtures.tenantB.organizationId,
      actorUserId: fixtures.tenantB.admin.id,
      rows: [
        {
          action: AuditAction.INVITATION_SENT,
          targetType: AuditTargetType.INVITATION,
          targetId: crypto.randomUUID(),
          metadata: { email: 'invitee-b@example.com', role: 'member' },
        },
      ],
    });

    mockAuthenticatedSession(
      fixtures.tenantA.admin.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.email
    );

    const response = await getExport('?startDate=2025-06-01&endDate=2025-06-30');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Content-Disposition')).toMatch(
      new RegExp(`attachment; filename="${fixtures.tenantA.slug}_export_.+\\.zip"`)
    );

    const buffer = await response.arrayBuffer();
    const files = unzipExport(buffer);

    expect(files['members.json']).toBeDefined();
    expect(files['time_logs.csv']).toBeDefined();
    expect(files['audit_logs.json']).toBeDefined();
    expect(files['manifest.json']).toBeDefined();

    const members = JSON.parse(files['members.json']) as Array<{ email: string }>;
    const memberEmails = members.map((row) => row.email);
    expect(memberEmails).toContain(fixtures.tenantA.member.email);
    expect(memberEmails).not.toContain(fixtures.tenantB.member.email);
    expect(memberEmails).not.toContain(fixtures.tenantB.admin.email);

    expect(files['time_logs.csv']).toContain(fixtures.tenantA.member.email);
    expect(files['time_logs.csv']).not.toContain(fixtures.tenantB.member.email);

    const auditLogs = JSON.parse(files['audit_logs.json']) as Array<{ actorEmail: string }>;
    const auditEmails = auditLogs.map((row) => row.actorEmail);
    expect(auditEmails).toContain(fixtures.tenantA.admin.email);
    expect(auditEmails).not.toContain(fixtures.tenantB.admin.email);

    const manifest = JSON.parse(files['manifest.json']) as {
      organizationId: string;
      counts: { members: number; timeLogs: number; auditLogs: number };
    };
    expect(manifest.organizationId).toBe(fixtures.tenantA.organizationId);
    expect(manifest.counts.members).toBeGreaterThanOrEqual(3);
    expect(manifest.counts.timeLogs).toBe(1);
    expect(manifest.counts.auditLogs).toBe(1);
  });
});

if (!dbReady) {
  console.warn(
    '[route] Test database not available — skipped DB-backed export tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
