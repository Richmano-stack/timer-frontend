import '../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationErrorCodes } from '@/lib/errors/invitation';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetTenantIsolationTestData,
  seedTenantIsolationFixtures,
  type TenantIsolationFixture,
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

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getMyDay(query: Record<string, string> = {}) {
  const params = new URLSearchParams(query);
  const { GET } = await import('@/app/api/time/my-day/route');
  return GET(
    new Request(`http://localhost:3000/api/time/my-day?${params.toString()}`)
  );
}

async function postClockIn(body: unknown = {}) {
  const { POST } = await import('@/app/api/time/clock-in/route');
  return POST(
    new Request('http://localhost:3000/api/time/clock-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

async function postClockOut() {
  const { POST } = await import('@/app/api/time/clock-out/route');
  return POST(
    new Request('http://localhost:3000/api/time/clock-out', { method: 'POST' })
  );
}

async function postStatus(body: unknown) {
  const { POST } = await import('@/app/api/time/status/route');
  return POST(
    new Request('http://localhost:3000/api/time/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

async function getAdminOverview() {
  const { GET } = await import('@/app/api/admin/overview/route');
  return GET(new Request('http://localhost:3000/api/admin/overview'));
}

async function getAdminTimesheets(startDate: string, endDate: string) {
  const { GET } = await import('@/app/api/admin/timesheets/route');
  const params = new URLSearchParams({ startDate, endDate });
  return GET(
    new Request(`http://localhost:3000/api/admin/timesheets?${params.toString()}`)
  );
}

async function getTeam() {
  const { GET } = await import('@/app/api/organization/team/route');
  return GET(new Request('http://localhost:3000/api/organization/team'));
}

async function getJoinSettings() {
  const { GET } = await import('@/app/api/organization/join-settings/route');
  return GET(new Request('http://localhost:3000/api/organization/join-settings'));
}

async function patchJoinSettings(allowedDomains: string[]) {
  const { PATCH } = await import('@/app/api/organization/join-settings/route');
  return PATCH(
    new Request('http://localhost:3000/api/organization/join-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedDomains }),
    })
  );
}

async function getInvitations() {
  const { GET } = await import('@/app/api/organization/invitations/route');
  return GET(new Request('http://localhost:3000/api/organization/invitations'));
}

async function postInvitation(email: string, role: 'member' | 'admin' = 'member') {
  const { POST } = await import('@/app/api/organization/invitations/route');
  return POST(
    new Request('http://localhost:3000/api/organization/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
  );
}

async function deleteInvitation(id: string) {
  const { DELETE } = await import('@/app/api/organization/invitations/[id]/route');
  return DELETE(
    new Request(`http://localhost:3000/api/organization/invitations/${id}`, {
      method: 'DELETE',
    }),
    { params: Promise.resolve({ id }) }
  );
}

async function patchMemberRole(memberId: string, role: string) {
  const { PATCH } = await import('@/app/api/organization/members/[memberId]/role/route');
  return PATCH(
    new Request(
      `http://localhost:3000/api/organization/members/${memberId}/role`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }
    ),
    { params: Promise.resolve({ memberId }) }
  );
}

async function seedTenantBOpenShift(
  prisma: ReturnType<typeof getTestPrisma>,
  tenantB: TenantIsolationFixture
) {
  await prisma.timeLog.create({
    data: {
      id: 'test-isolation-timelog-b-open',
      userId: tenantB.member.id,
      organizationId: tenantB.organizationId,
      activityStatusId: tenantB.availableStatusId,
      startTime: new Date(`${todayUtcDate()}T10:00:00.000Z`),
    },
  });
}

async function seedTenantBClosedShift(
  prisma: ReturnType<typeof getTestPrisma>,
  tenantB: TenantIsolationFixture
) {
  const date = todayUtcDate();
  await prisma.timeLog.create({
    data: {
      id: 'test-isolation-timelog-b-closed',
      userId: tenantB.member.id,
      organizationId: tenantB.organizationId,
      activityStatusId: tenantB.availableStatusId,
      startTime: new Date(`${date}T08:00:00.000Z`),
      endTime: new Date(`${date}T16:00:00.000Z`),
    },
  });
}

async function seedTenantBInvitation(
  prisma: ReturnType<typeof getTestPrisma>,
  tenantB: TenantIsolationFixture
) {
  return prisma.invitation.create({
    data: {
      id: 'test-isolation-invite-b',
      organizationId: tenantB.organizationId,
      email: 'foreign@isolation-test.local',
      role: 'member',
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
      inviterId: tenantB.owner.id,
    },
  });
}

describe.skipIf(!dbReady)('Cross-tenant isolation (TKT-119)', () => {
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

  describe('Time endpoints', () => {
    it('GET /api/time/my-day returns only the authenticated tenant member data', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.member.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.member.email
      );

      const response = await getMyDay({ date: todayUtcDate() });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.employeeName).toBe('agent-a');
      expect(body.data.activityStatuses.every(
        (status: { id: string }) =>
          !status.id.includes(fixtures.tenantB.organizationId)
      )).toBe(true);
    });

    it('GET /api/time/my-day?userId= rejects cross-tenant member lookup', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const response = await getMyDay({
        userId: fixtures.tenantB.member.id,
        date: todayUtcDate(),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY);
    });

    it('POST /api/time/clock-in writes only to the session organization', async () => {
      const tenantBLogsBefore = await prisma.timeLog.count({
        where: { organizationId: fixtures.tenantB.organizationId },
      });

      mockAuthenticatedSession(
        fixtures.tenantA.member.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.member.email
      );

      const response = await postClockIn();

      expect(response.status).toBe(200);

      const tenantALogs = await prisma.timeLog.findMany({
        where: { organizationId: fixtures.tenantA.organizationId },
      });
      const tenantBLogsAfter = await prisma.timeLog.count({
        where: { organizationId: fixtures.tenantB.organizationId },
      });

      expect(tenantALogs).toHaveLength(1);
      expect(tenantALogs[0]?.userId).toBe(fixtures.tenantA.member.id);
      expect(tenantBLogsAfter).toBe(tenantBLogsBefore);
    });

    it('POST /api/time/status rejects cross-tenant activity status ids', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.member.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.member.email
      );

      await postClockIn();

      const response = await postStatus({ statusId: fixtures.tenantB.availableStatusId });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND);
    });

    it('POST /api/time/clock-out does not close cross-tenant sessions', async () => {
      await seedTenantBOpenShift(prisma, fixtures.tenantB);

      mockAuthenticatedSession(
        fixtures.tenantA.member.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.member.email
      );

      await postClockIn();
      const response = await postClockOut();
      expect(response.status).toBe(200);

      const tenantBOpen = await prisma.timeLog.findFirst({
        where: {
          organizationId: fixtures.tenantB.organizationId,
          endTime: null,
        },
      });
      expect(tenantBOpen).not.toBeNull();
    });
  });

  describe('Admin endpoints', () => {
    it('GET /api/admin/overview excludes agents from another tenant', async () => {
      await seedTenantBOpenShift(prisma, fixtures.tenantB);

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
      expect(agentUserIds).not.toContain(fixtures.tenantB.member.id);
      expect(agentUserIds.every((id: string) => id.endsWith('-a'))).toBe(true);
    });

    it('GET /api/admin/timesheets excludes rows from another tenant', async () => {
      await seedTenantBClosedShift(prisma, fixtures.tenantB);
      const date = todayUtcDate();

      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const response = await getAdminTimesheets(date, date);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.rows).toHaveLength(0);
    });
  });

  describe('Organization endpoints', () => {
    it('GET /api/organization/team lists only active-tenant members', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const response = await getTeam();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe(fixtures.tenantA.slug);

      const memberEmails = body.data.members.map(
        (member: { user: { email: string } }) => member.user.email
      );
      expect(memberEmails.every((email: string) => email.endsWith('-a@isolation-test.local'))).toBe(
        true
      );
      expect(memberEmails).not.toContain(fixtures.tenantB.member.email);
    });

    it('GET /api/organization/join-settings returns active-tenant settings only', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const response = await getJoinSettings();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.organizationId).toBe(fixtures.tenantA.organizationId);
      expect(body.data.organizationSlug).toBe(fixtures.tenantA.slug);
      expect(body.data.allowedDomains).toEqual(['tenant-a.example']);
    });

    it('PATCH /api/organization/join-settings does not mutate another tenant', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const response = await patchJoinSettings(['updated-a.example']);

      expect(response.status).toBe(200);

      const tenantBOrg = await prisma.organization.findUnique({
        where: { id: fixtures.tenantB.organizationId },
        select: { metadata: true },
      });

      expect(tenantBOrg?.metadata).toContain('tenant-b.example');
      expect(tenantBOrg?.metadata).not.toContain('updated-a.example');
    });

    it('GET /api/organization/invitations excludes pending invites from another tenant', async () => {
      await seedTenantBInvitation(prisma, fixtures.tenantB);

      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const createResponse = await postInvitation('invite-a@example.com');
      expect(createResponse.status).toBe(200);

      const response = await getInvitations();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('invite-a@example.com');
      expect(body.data.every(
        (invite: { email: string }) => invite.email !== 'foreign@isolation-test.local'
      )).toBe(true);
    });

    it('POST /api/organization/invitations creates records scoped to the session tenant', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const response = await postInvitation('scoped-a@example.com');

      expect(response.status).toBe(200);
      const body = await response.json();

      const stored = await prisma.invitation.findUnique({
        where: { id: body.data.id },
      });

      expect(stored?.organizationId).toBe(fixtures.tenantA.organizationId);
      expect(stored?.organizationId).not.toBe(fixtures.tenantB.organizationId);
    });

    it('DELETE /api/organization/invitations/[id] returns 404 for cross-tenant invitation id', async () => {
      const foreignInvitation = await seedTenantBInvitation(prisma, fixtures.tenantB);

      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
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

    it('PATCH /api/organization/members/[memberId]/role rejects cross-tenant member id', async () => {
      mockAuthenticatedSession(
        fixtures.tenantA.admin.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.admin.email
      );

      const response = await patchMemberRole(fixtures.tenantB.member.memberId, 'admin');

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY);

      const unchanged = await prisma.member.findUnique({
        where: { id: fixtures.tenantB.member.memberId },
      });
      expect(unchanged?.role).toBe('member');
    });
  });

  describe('Join endpoints', () => {
    it('DELETE /api/organization/invitations/[id] cannot revoke another org invitation by wrong org session', async () => {
      const foreignInvitation = await seedTenantBInvitation(prisma, fixtures.tenantB);

      mockAuthenticatedSession(
        fixtures.tenantA.owner.id,
        fixtures.tenantA.organizationId,
        fixtures.tenantA.owner.email
      );

      const response = await deleteInvitation(foreignInvitation.id);

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe(InvitationErrorCodes.INVITATION_NOT_FOUND);
    });
  });

  describe('Join-request queue (TKT-106 — pending merge)', () => {
    it.todo('POST /api/join/request rejects cross-tenant org slug manipulation (TKT-106)');
    it.todo(
      'POST /api/organization/join-requests/[id]/approve rejects cross-tenant request id (TKT-106)'
    );
    it.todo('GET /api/organization/join-requests lists only active org requests (TKT-106)');
  });
});

if (!dbReady) {
  console.warn(
    '[integration] Test database not available — skipped tenant isolation tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
