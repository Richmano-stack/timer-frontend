import '../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { HEARTBEAT_WRITE_INTERVAL_MS } from '@/lib/services/member-heartbeat.service';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetTenantIsolationTestData,
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

function mockAuthenticatedSession(
  userId: string,
  organizationId: string,
  email: string
) {
  mockGetSession.mockResolvedValue({
    user: { id: userId, email, name: email.split('@')[0] },
    session: { activeOrganizationId: organizationId },
  });
}

async function postHeartbeat() {
  const { POST } = await import('@/app/api/time/heartbeat/route');
  return POST(new Request('http://localhost:3000/api/time/heartbeat', { method: 'POST' }));
}

describe.skipIf(!dbReady)('Member heartbeat (TKT-208)', () => {
  const prisma = getTestPrisma();
  let fixtures: TenantIsolationFixtures;

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetTenantIsolationTestData(prisma);
    fixtures = await seedTenantIsolationFixtures(prisma);
  });

  afterAll(async () => {
    await resetTenantIsolationTestData(prisma);
    await prisma.$disconnect();
  });

  it('updates lastSeenAt for the authenticated member on first heartbeat', async () => {
    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const before = await prisma.member.findUnique({
      where: { id: fixtures.tenantA.member.memberId },
      select: { lastSeenAt: true },
    });
    expect(before?.lastSeenAt).toBeNull();

    const response = await postHeartbeat();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(true);
    expect(body.data.lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const after = await prisma.member.findUnique({
      where: { id: fixtures.tenantA.member.memberId },
      select: { lastSeenAt: true },
    });
    expect(after?.lastSeenAt).not.toBeNull();
    expect(after?.lastSeenAt?.toISOString()).toBe(body.data.lastSeenAt);
  });

  it('skips the database write when lastSeenAt is newer than the write interval', async () => {
    const recent = new Date();
    await prisma.member.update({
      where: { id: fixtures.tenantA.member.memberId },
      data: { lastSeenAt: recent },
    });

    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const response = await postHeartbeat();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(false);
    expect(body.data.lastSeenAt).toBe(recent.toISOString());

    const row = await prisma.member.findUnique({
      where: { id: fixtures.tenantA.member.memberId },
      select: { lastSeenAt: true },
    });
    expect(row?.lastSeenAt?.toISOString()).toBe(recent.toISOString());
  });

  it('persists again after the write interval elapses', async () => {
    const stale = new Date(Date.now() - HEARTBEAT_WRITE_INTERVAL_MS - 1_000);
    await prisma.member.update({
      where: { id: fixtures.tenantA.member.memberId },
      data: { lastSeenAt: stale },
    });

    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const response = await postHeartbeat();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.updated).toBe(true);
    expect(new Date(body.data.lastSeenAt).getTime()).toBeGreaterThan(stale.getTime());
  });

  it('only updates the caller membership row within their active organization', async () => {
    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const response = await postHeartbeat();
    expect(response.status).toBe(200);

    const tenantAMember = await prisma.member.findUnique({
      where: { id: fixtures.tenantA.member.memberId },
      select: { lastSeenAt: true },
    });
    const tenantBMember = await prisma.member.findUnique({
      where: { id: fixtures.tenantB.member.memberId },
      select: { lastSeenAt: true },
    });

    expect(tenantAMember?.lastSeenAt).not.toBeNull();
    expect(tenantBMember?.lastSeenAt).toBeNull();
  });

  it('rejects heartbeat for deactivated members with 403', async () => {
    await prisma.member.update({
      where: { id: fixtures.tenantA.member.memberId },
      data: { status: 'DEACTIVATED' },
    });

    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const response = await postHeartbeat();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.MEMBER_DEACTIVATED);
  });
});
