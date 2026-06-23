import '../../../../../test/setup/integration-env';
import { StatusType } from '@prisma/client';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityStatusErrorCodes } from '@/lib/errors/activity-status';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetActivityStatusTestData,
  seedActivityStatusTestFixtures,
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

function getActivityStatuses(headers: Record<string, string> = {}) {
  return import('../route').then(({ GET }) =>
    GET(
      new Request('http://localhost:3000/api/organization/activity-statuses', {
        method: 'GET',
        headers,
      })
    )
  );
}

function postActivityStatus(body: unknown, headers: Record<string, string> = {}) {
  return import('../route').then(({ POST }) =>
    POST(
      new Request('http://localhost:3000/api/organization/activity-statuses', {
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

function patchActivityStatus(id: string, body: unknown, headers: Record<string, string> = {}) {
  return import('../[id]/route').then(({ PATCH }) =>
    PATCH(
      new Request(`http://localhost:3000/api/organization/activity-statuses/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    )
  );
}

function deleteActivityStatus(id: string, headers: Record<string, string> = {}) {
  return import('../[id]/route').then(({ DELETE }) =>
    DELETE(
      new Request(`http://localhost:3000/api/organization/activity-statuses/${id}`, {
        method: 'DELETE',
        headers,
      }),
      { params: Promise.resolve({ id }) }
    )
  );
}

describe('POST /api/organization/activity-statuses', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 400 VALIDATION_ERROR for invalid payload', async () => {
    const response = await postActivityStatus({
      name: '',
      type: 'INVALID',
      colorCode: 'not-a-color',
      isBillable: true,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.VALIDATION_ERROR);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for invalid JSON body', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/organization/activity-statuses', {
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

    const response = await postActivityStatus({
      name: 'Custom Status',
      type: StatusType.PRODUCTIVE,
      colorCode: '#112233',
      isBillable: true,
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('POST /api/organization/activity-statuses (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetActivityStatusTestData(prisma);
  });

  it('returns 403 FORBIDDEN for non-admin members', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.member.id,
      fixtures.organizationId,
      fixtures.member.email
    );

    const response = await postActivityStatus({
      name: 'Custom Status',
      type: StatusType.PRODUCTIVE,
      colorCode: '#112233',
      isBillable: true,
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
  });

  it('creates an activity status for an admin', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.admin.id,
      fixtures.organizationId,
      fixtures.admin.email
    );

    const response = await postActivityStatus({
      name: '  Escalations  ',
      type: StatusType.PRODUCTIVE,
      colorCode: '#aabbcc',
      isBillable: true,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      name: 'Escalations',
      type: StatusType.PRODUCTIVE,
      colorCode: '#aabbcc',
      isBillable: true,
      isProductive: true,
    });
    expect(body.data.id).toBeTruthy();

    const stored = await prisma.activityStatus.findUnique({
      where: { id: body.data.id },
    });

    expect(stored).not.toBeNull();
    expect(stored?.organizationId).toBe(fixtures.organizationId);
    expect(stored?.name).toBe('Escalations');
  });

  it('returns 409 ACTIVITY_STATUS_NAME_CONFLICT for duplicate names', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const first = await postActivityStatus({
      name: 'Duplicate Name',
      type: StatusType.BREAK,
      colorCode: '#111111',
      isBillable: false,
    });
    expect(first.status).toBe(200);

    const second = await postActivityStatus({
      name: 'Duplicate Name',
      type: StatusType.TRAINING,
      colorCode: '#222222',
      isBillable: true,
    });

    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ActivityStatusErrorCodes.ACTIVITY_STATUS_NAME_CONFLICT);
  });
});

describe('GET /api/organization/activity-statuses', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await getActivityStatuses();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('GET /api/organization/activity-statuses (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetActivityStatusTestData(prisma);
  });

  it('returns 403 FORBIDDEN for non-admin members', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.member.id,
      fixtures.organizationId,
      fixtures.member.email
    );

    const response = await getActivityStatuses();

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.FORBIDDEN);
  });

  it('lists activity statuses scoped to the active organization', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    const otherOrg = await seedActivityStatusTestFixtures(prisma, 'test-activity-status-other');

    mockAuthenticatedSession(
      fixtures.admin.id,
      fixtures.organizationId,
      fixtures.admin.email
    );

    const response = await getActivityStatuses();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((status: { id: string }) => status.id !== otherOrg.availableStatusId)).toBe(
      true
    );
    expect(body.data[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      type: expect.any(String),
      colorCode: expect.any(String),
      isBillable: expect.any(Boolean),
      isProductive: expect.any(Boolean),
    });
  });
});

describe('PATCH /api/organization/activity-statuses/[id]', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await patchActivityStatus('some-id', { name: 'Updated' });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });

  it('returns 400 VALIDATION_ERROR when body is empty', async () => {
    const response = await patchActivityStatus('some-id', {});

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.VALIDATION_ERROR);
    expect(mockGetSession).not.toHaveBeenCalled();
  });
});

describe.skipIf(!dbReady)('PATCH /api/organization/activity-statuses/[id] (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetActivityStatusTestData(prisma);
  });

  it('updates an activity status for an admin', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.admin.id,
      fixtures.organizationId,
      fixtures.admin.email
    );

    const createResponse = await postActivityStatus({
      name: 'Patch Me',
      type: StatusType.BREAK,
      colorCode: '#334455',
      isBillable: false,
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();

    const response = await patchActivityStatus(created.data.id, {
      name: 'Patched Status',
      isBillable: true,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: created.data.id,
      name: 'Patched Status',
      isBillable: true,
      isProductive: false,
    });
  });

  it('returns 404 ACTIVITY_STATUS_NOT_FOUND for cross-tenant status id', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    const otherOrg = await seedActivityStatusTestFixtures(prisma, 'test-activity-status-foreign');

    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const response = await patchActivityStatus(otherOrg.availableStatusId, {
      name: 'Should Not Update',
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND);

    const unchanged = await prisma.activityStatus.findUnique({
      where: { id: otherOrg.availableStatusId },
    });
    expect(unchanged?.name).toBe('Available');
  });

  it('returns 409 ACTIVITY_STATUS_IN_USE when status is on an open shift', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    await prisma.timeLog.create({
      data: {
        userId: fixtures.member.id,
        organizationId: fixtures.organizationId,
        activityStatusId: fixtures.availableStatusId,
        startTime: new Date(),
        endTime: null,
      },
    });

    const response = await patchActivityStatus(fixtures.availableStatusId, {
      colorCode: '#ffffff',
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ActivityStatusErrorCodes.ACTIVITY_STATUS_IN_USE);
  });
});

describe('DELETE /api/organization/activity-statuses/[id]', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('returns 401 UNAUTHORIZED when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await deleteActivityStatus('some-id');

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.UNAUTHORIZED);
  });
});

describe.skipIf(!dbReady)('DELETE /api/organization/activity-statuses/[id] (database)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockGetSession.mockReset();
    await resetActivityStatusTestData(prisma);
  });

  it('deletes an unused activity status for an owner', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.owner.id,
      fixtures.organizationId,
      fixtures.owner.email
    );

    const createResponse = await postActivityStatus({
      name: 'Delete Me',
      type: StatusType.TRAINING,
      colorCode: '#556677',
      isBillable: true,
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();

    const response = await deleteActivityStatus(created.data.id);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      id: created.data.id,
      name: 'Delete Me',
    });

    const stored = await prisma.activityStatus.findUnique({
      where: { id: created.data.id },
    });
    expect(stored).toBeNull();
  });

  it('returns 404 ACTIVITY_STATUS_NOT_FOUND for cross-tenant status id', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    const otherOrg = await seedActivityStatusTestFixtures(prisma, 'test-activity-status-delete-foreign');

    mockAuthenticatedSession(
      fixtures.admin.id,
      fixtures.organizationId,
      fixtures.admin.email
    );

    const response = await deleteActivityStatus(otherOrg.availableStatusId);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND);

    const unchanged = await prisma.activityStatus.findUnique({
      where: { id: otherOrg.availableStatusId },
    });
    expect(unchanged).not.toBeNull();
  });

  it('returns 409 ACTIVITY_STATUS_IN_USE when status is on an open shift', async () => {
    const fixtures = await seedActivityStatusTestFixtures(prisma);
    mockAuthenticatedSession(
      fixtures.admin.id,
      fixtures.organizationId,
      fixtures.admin.email
    );

    const createResponse = await postActivityStatus({
      name: 'Open Shift Status',
      type: StatusType.PRODUCTIVE,
      colorCode: '#778899',
      isBillable: true,
    });
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();

    await prisma.timeLog.create({
      data: {
        userId: fixtures.member.id,
        organizationId: fixtures.organizationId,
        activityStatusId: created.data.id,
        startTime: new Date(),
        endTime: null,
      },
    });

    const response = await deleteActivityStatus(created.data.id);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ActivityStatusErrorCodes.ACTIVITY_STATUS_IN_USE);

    const stillThere = await prisma.activityStatus.findUnique({
      where: { id: created.data.id },
    });
    expect(stillThere).not.toBeNull();
  });
});

if (!dbReady) {
  console.warn(
    '[route] Test database not available — skipped DB-backed activity status tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
