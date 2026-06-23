import '../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
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

async function patchMemberStatus(memberId: string, status: 'ACTIVE' | 'DEACTIVATED') {
  const { PATCH } = await import('@/app/api/organization/members/[memberId]/status/route');
  return PATCH(
    new Request(
      `http://localhost:3000/api/organization/members/${memberId}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    ),
    { params: Promise.resolve({ memberId }) }
  );
}

async function postClockIn() {
  const { POST } = await import('@/app/api/time/clock-in/route');
  return POST(
    new Request('http://localhost:3000/api/time/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  );
}

async function getAdminOverview() {
  const { GET } = await import('@/app/api/admin/overview/route');
  return GET(new Request('http://localhost:3000/api/admin/overview'));
}

describe.skipIf(!dbReady)('Member status lifecycle (TKT-203)', () => {
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

  it('PATCH deactivates a member and blocks subsequent clock-in with 403', async () => {
    mockAuthenticatedSession(
      fixtures.tenantA.admin.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.email
    );

    const deactivateResponse = await patchMemberStatus(
      fixtures.tenantA.member.memberId,
      'DEACTIVATED'
    );

    expect(deactivateResponse.status).toBe(200);
    const deactivateBody = await deactivateResponse.json();
    expect(deactivateBody.success).toBe(true);
    expect(deactivateBody.data.status).toBe('DEACTIVATED');

    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const clockInResponse = await postClockIn();

    expect(clockInResponse.status).toBe(403);
    const clockInBody = await clockInResponse.json();
    expect(clockInBody.success).toBe(false);
    expect(clockInBody.error.code).toBe(TimeTrackingErrorCodes.MEMBER_DEACTIVATED);
  });

  it('PATCH reactivates a deactivated member so clock-in succeeds again', async () => {
    await prisma.member.update({
      where: { id: fixtures.tenantA.member.memberId },
      data: { status: 'DEACTIVATED' },
    });

    mockAuthenticatedSession(
      fixtures.tenantA.admin.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.email
    );

    const reactivateResponse = await patchMemberStatus(
      fixtures.tenantA.member.memberId,
      'ACTIVE'
    );
    expect(reactivateResponse.status).toBe(200);

    mockAuthenticatedSession(
      fixtures.tenantA.member.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.email
    );

    const clockInResponse = await postClockIn();
    expect(clockInResponse.status).toBe(200);
  });

  it('PATCH rejects cross-tenant member id', async () => {
    mockAuthenticatedSession(
      fixtures.tenantA.admin.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.email
    );

    const response = await patchMemberStatus(
      fixtures.tenantB.member.memberId,
      'DEACTIVATED'
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY);

    const unchanged = await prisma.member.findUnique({
      where: { id: fixtures.tenantB.member.memberId },
    });
    expect(unchanged?.status).toBe('ACTIVE');
  });

  it('cannot deactivate the last owner of an organization', async () => {
    mockAuthenticatedSession(
      fixtures.tenantA.owner.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.owner.email
    );

    const response = await patchMemberStatus(
      fixtures.tenantA.owner.memberId,
      'DEACTIVATED'
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
    expect(body.error.message).toContain('last owner');
  });

  it('GET /api/admin/overview excludes deactivated members from floor list', async () => {
    await prisma.member.update({
      where: { id: fixtures.tenantA.member.memberId },
      data: { status: 'DEACTIVATED' },
    });

    mockAuthenticatedSession(
      fixtures.tenantA.admin.id,
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.email
    );

    const response = await getAdminOverview();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);

    const agentUserIds = body.data.floorAgents.map(
      (agent: { userId: string }) => agent.userId
    );
    expect(agentUserIds).not.toContain(fixtures.tenantA.member.id);
    expect(body.data.kpis.totalRegistered).toBe(2);
  });
});

if (!dbReady) {
  console.warn(
    '[integration] Test database not available — skipped member status tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
