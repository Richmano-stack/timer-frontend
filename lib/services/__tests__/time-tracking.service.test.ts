import { Prisma, StatusType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  ORG_ID,
  USER_ID,
  makeActivityStatus,
  makeTimeLogSegment,
} from '@/test/fixtures/time-log';

const {
  mockFindFirst,
  mockFindMany,
  mockCreate,
  mockUpdate,
  mockUpdateMany,
  mockTransaction,
  mockUserFindFirst,
  mockActivityStatusFindMany,
  mockOrganizationFindUnique,
  mockResolveOrganizationContext,
  mockResolveAvailableStatus,
  mockResolveActivityStatus,
  mockUtcNow,
  mockCheckMemberActive,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockActivityStatusFindMany: vi.fn(),
  mockOrganizationFindUnique: vi.fn(),
  mockResolveOrganizationContext: vi.fn(),
  mockResolveAvailableStatus: vi.fn(),
  mockResolveActivityStatus: vi.fn(),
  mockUtcNow: vi.fn(),
  mockCheckMemberActive: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    timeLog: {
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
    user: {
      findFirst: mockUserFindFirst,
    },
    activityStatus: {
      findMany: mockActivityStatusFindMany,
    },
    organization: {
      findUnique: mockOrganizationFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/services/organization-team.service', () => ({
  checkMemberActive: mockCheckMemberActive,
}));

vi.mock('@/lib/security/organization-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security/organization-context')>();
  return {
    ...actual,
    resolveOrganizationContext: mockResolveOrganizationContext,
  };
});

vi.mock('@/lib/security/activity-status', () => ({
  resolveAvailableStatus: mockResolveAvailableStatus,
  resolveActivityStatus: mockResolveActivityStatus,
}));

vi.mock('@/lib/utils/time', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/time')>();
  return {
    ...actual,
    utcNow: mockUtcNow,
  };
});

import {
  clockInService,
  clockOutService,
  getMyDayService,
  setStatusService,
} from '@/lib/services/time-tracking.service';

const availableStatus = {
  id: 'status-available',
  name: 'Available',
  type: StatusType.PRODUCTIVE,
  colorCode: '#6366f1',
  isBillable: true,
  isProductive: true,
};

const lunchStatus = {
  id: 'status-lunch',
  name: 'Lunch',
  type: StatusType.BREAK,
  colorCode: '#94a3b8',
  isBillable: false,
  isProductive: false,
};

function memberActiveSuccess() {
  mockCheckMemberActive.mockResolvedValue({
    success: true,
    data: { userId: USER_ID, organizationId: ORG_ID },
  });
}

function tenantSuccess() {
  mockResolveOrganizationContext.mockResolvedValue({
    success: true,
    data: { userId: USER_ID, organizationId: ORG_ID },
  });
}

function tenantFailure() {
  mockResolveOrganizationContext.mockResolvedValue({
    success: false,
    error: {
      code: TimeTrackingErrorCodes.USER_NOT_IN_COMPANY,
      message: 'User is not a member of the specified organization.',
    },
  });
}

function mockClockInTransaction() {
  mockTransaction.mockImplementation(async (callback) =>
    callback({
      timeLog: {
        findFirst: mockFindFirst,
        create: mockCreate,
      },
    })
  );
}

function mockClockOutTransaction() {
  mockTransaction.mockImplementation(async (callback) =>
    callback({
      timeLog: {
        updateMany: mockUpdateMany,
        findFirst: mockFindFirst,
      },
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUtcNow.mockReturnValue(new Date('2026-06-10T12:00:00.000Z'));
  mockOrganizationFindUnique.mockResolvedValue({ timezone: 'UTC' });
  memberActiveSuccess();
  tenantSuccess();
});

describe('clockInService', () => {
  it('returns USER_NOT_IN_COMPANY when resolveOrganizationContext fails', async () => {
    tenantFailure();

    const result = await clockInService(USER_ID, ORG_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns USER_ALREADY_CLOCKED_IN when an open segment exists for user+org', async () => {
    mockResolveAvailableStatus.mockResolvedValue({ success: true, data: availableStatus });
    mockFindFirst.mockResolvedValue(makeTimeLogSegment());
    mockClockInTransaction();

    const result = await clockInService(USER_ID, ORG_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.USER_ALREADY_CLOCKED_IN);
    }
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns USER_ALREADY_CLOCKED_IN when partial unique index rejects concurrent create (P2002)', async () => {
    mockResolveAvailableStatus.mockResolvedValue({ success: true, data: availableStatus });
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );
    mockClockInTransaction();

    const result = await clockInService(USER_ID, ORG_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.USER_ALREADY_CLOCKED_IN);
    }
  });

  it('returns ACTIVITY_STATUS_NOT_FOUND when Available status is missing for org', async () => {
    mockResolveAvailableStatus.mockResolvedValue({
      success: false,
      error: {
        code: TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
        message: 'Activity status not found for this organization.',
      },
    });

    const result = await clockInService(USER_ID, ORG_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('creates a TimeLog with Available status and null endTime on happy path', async () => {
    mockResolveAvailableStatus.mockResolvedValue({ success: true, data: availableStatus });
    mockFindFirst.mockResolvedValue(null);
    const created = makeTimeLogSegment();
    mockCreate.mockResolvedValue(created);
    mockClockInTransaction();

    const result = await clockInService(USER_ID, ORG_ID, 'Starting shift');

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          organizationId: ORG_ID,
          activityStatusId: availableStatus.id,
          notes: 'Starting shift',
        }),
      })
    );
    if (result.success) {
      expect(result.data.segment.endTime).toBeNull();
      expect(result.data.segment.statusName).toBe('Available');
    }
  });

  it('never creates a segment when user is not a member of organizationId', async () => {
    tenantFailure();

    await clockInService(USER_ID, 'other-org');

    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('clockOutService', () => {
  it('returns NO_ACTIVE_SESSION_FOUND when no open segment exists', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await clockOutService(USER_ID, ORG_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND);
    }
  });

  it('sets endTime on the open segment and returns closed segment on happy path', async () => {
    const open = makeTimeLogSegment({ id: 'open-seg' });
    const closed = {
      ...open,
      endTime: new Date('2026-06-10T12:00:00.000Z'),
    };
    mockFindFirst.mockResolvedValueOnce(open).mockResolvedValueOnce(closed);
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockClockOutTransaction();

    const result = await clockOutService(USER_ID, ORG_ID);

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'open-seg',
          userId: USER_ID,
          organizationId: ORG_ID,
          endTime: null,
        }),
        data: { endTime: new Date('2026-06-10T12:00:00.000Z') },
      })
    );
    if (result.success) {
      expect(result.data.segment.endTime).not.toBeNull();
    }
  });

  it('does not close segments belonging to a different user in the same org', async () => {
    mockResolveOrganizationContext.mockResolvedValue({
      success: true,
      data: { userId: 'other-user', organizationId: ORG_ID },
    });
    mockFindFirst.mockResolvedValue(null);

    const result = await clockOutService('other-user', ORG_ID);

    expect(result.success).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'other-user', organizationId: ORG_ID }),
      })
    );
  });
});

describe('setStatusService', () => {
  it('returns NO_ACTIVE_SESSION_FOUND when user is clocked out', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await setStatusService(USER_ID, ORG_ID, lunchStatus.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND);
    }
  });

  it('is idempotent when target status matches current open segment (no new row)', async () => {
    const open = makeTimeLogSegment({ activityStatusId: availableStatus.id });
    mockFindFirst.mockResolvedValue(open);
    mockResolveActivityStatus.mockResolvedValue({ success: true, data: availableStatus });

    const result = await setStatusService(USER_ID, ORG_ID, availableStatus.id);

    expect(result.success).toBe(true);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('rejects ACTIVITY_STATUS_NOT_FOUND when statusId belongs to another organization', async () => {
    mockFindFirst.mockResolvedValue(makeTimeLogSegment());
    mockResolveActivityStatus.mockResolvedValue({
      success: false,
      error: {
        code: TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
        message: 'Activity status not found for this organization.',
      },
    });

    const result = await setStatusService(USER_ID, ORG_ID, 'foreign-status-id');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('closes open segment and creates new segment in a single transaction on status change', async () => {
    const open = makeTimeLogSegment({ id: 'open-seg', activityStatusId: availableStatus.id });
    const created = makeTimeLogSegment({
      id: 'new-seg',
      activityStatusId: lunchStatus.id,
      activityStatus: makeActivityStatus({
        id: lunchStatus.id,
        name: 'Lunch',
        type: StatusType.BREAK,
      }),
    });

    mockFindFirst.mockResolvedValue(open);
    mockResolveActivityStatus.mockResolvedValue({ success: true, data: lunchStatus });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        timeLog: {
          updateMany: mockUpdateMany.mockResolvedValue({ count: 1 }),
          create: mockCreate.mockResolvedValue(created),
        },
      })
    );

    const result = await setStatusService(USER_ID, ORG_ID, lunchStatus.id);

    expect(result.success).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'open-seg',
          userId: USER_ID,
          organizationId: ORG_ID,
          endTime: null,
        }),
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ activityStatusId: lunchStatus.id }),
      })
    );
  });

  it('rolls back when transaction create fails (open segment endTime unchanged)', async () => {
    const open = makeTimeLogSegment({ id: 'open-seg', activityStatusId: availableStatus.id });
    mockFindFirst.mockResolvedValue(open);
    mockResolveActivityStatus.mockResolvedValue({ success: true, data: lunchStatus });
    mockTransaction.mockRejectedValue(new Error('transaction failed'));

    await expect(setStatusService(USER_ID, ORG_ID, lunchStatus.id)).rejects.toThrow(
      'transaction failed'
    );
  });

  it('returns USER_ALREADY_CLOCKED_IN when concurrent status swap hits partial unique index (P2002)', async () => {
    const open = makeTimeLogSegment({ id: 'open-seg', activityStatusId: availableStatus.id });
    mockFindFirst.mockResolvedValue(open);
    mockResolveActivityStatus.mockResolvedValue({ success: true, data: lunchStatus });
    mockTransaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    const result = await setStatusService(USER_ID, ORG_ID, lunchStatus.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.USER_ALREADY_CLOCKED_IN);
    }
  });

  it('resolves status by statusName when statusId is omitted', async () => {
    const open = makeTimeLogSegment({ activityStatusId: availableStatus.id });
    mockFindFirst.mockResolvedValue(open);
    mockResolveActivityStatus.mockResolvedValue({ success: true, data: lunchStatus });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        timeLog: {
          updateMany: mockUpdateMany.mockResolvedValue({ count: 1 }),
          create: mockCreate.mockResolvedValue(
            makeTimeLogSegment({
              activityStatusId: lunchStatus.id,
              activityStatus: makeActivityStatus({
                id: lunchStatus.id,
                name: 'Lunch',
                type: StatusType.BREAK,
              }),
            })
          ),
        },
      })
    );

    await setStatusService(USER_ID, ORG_ID, undefined, 'Lunch');

    expect(mockResolveActivityStatus).toHaveBeenCalledWith(ORG_ID, undefined, 'Lunch');
  });
});

describe('getMyDayService', () => {
  it('merges open segment into day when it started before UTC day boundary', async () => {
    const open = makeTimeLogSegment({
      id: 'open-overnight',
      startTime: new Date('2026-06-09T22:00:00.000Z'),
    });

    mockUserFindFirst.mockResolvedValue({ name: 'Agent One' });
    mockActivityStatusFindMany.mockResolvedValue([makeActivityStatus()]);
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(open);

    const result = await getMyDayService(USER_ID, ORG_ID, '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activities.some((row) => row.id === 'open-overnight')).toBe(true);
      expect(result.data.activeSession?.activeSegment?.id).toBe('open-overnight');
    }
  });

  it('computes breakDeductions only from non-productive segment types', async () => {
    const segments = [
      makeTimeLogSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T10:00:00.000Z'),
      }),
      makeTimeLogSegment({
        id: 'seg-2',
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: new Date('2026-06-10T10:30:00.000Z'),
        activityStatusId: lunchStatus.id,
        activityStatus: makeActivityStatus({
          id: lunchStatus.id,
          name: 'Lunch',
          type: StatusType.BREAK,
        }),
      }),
    ];

    mockUserFindFirst.mockResolvedValue({ name: 'Agent One' });
    mockActivityStatusFindMany.mockResolvedValue([makeActivityStatus()]);
    mockFindMany.mockResolvedValue(segments);
    mockFindFirst.mockResolvedValue(null);

    const result = await getMyDayService(USER_ID, ORG_ID, '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shifts[0]?.breakDeductions).toBe('30m');
    }
  });

  it('computes netWorkHours as gross minus breaks for a multi-segment shift', async () => {
    const segments = [
      makeTimeLogSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T10:00:00.000Z'),
      }),
      makeTimeLogSegment({
        id: 'seg-2',
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: new Date('2026-06-10T10:30:00.000Z'),
        activityStatusId: lunchStatus.id,
        activityStatus: makeActivityStatus({
          id: lunchStatus.id,
          name: 'Lunch',
          type: StatusType.BREAK,
        }),
      }),
      makeTimeLogSegment({
        id: 'seg-3',
        startTime: new Date('2026-06-10T10:30:00.000Z'),
        endTime: new Date('2026-06-10T11:30:00.000Z'),
      }),
    ];

    mockUserFindFirst.mockResolvedValue({ name: 'Agent One' });
    mockActivityStatusFindMany.mockResolvedValue([makeActivityStatus()]);
    mockFindMany.mockResolvedValue(segments);
    mockFindFirst.mockResolvedValue(null);

    const result = await getMyDayService(USER_ID, ORG_ID, '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shifts[0]?.netWorkHours).toBe('2.00');
    }
  });

  it('returns empty shifts and zero summary when no segments exist for date', async () => {
    mockUserFindFirst.mockResolvedValue({ name: 'Agent One' });
    mockActivityStatusFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(null);

    const result = await getMyDayService(USER_ID, ORG_ID, '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shifts).toEqual([]);
      expect(result.data.summary).toEqual({ gross: '0m', breaks: '0m', net: '0.0h' });
      expect(result.data.activeSession).toBeNull();
    }
  });

  it('returns activeSession when open segment exists', async () => {
    const open = makeTimeLogSegment({ id: 'open-seg' });
    mockUserFindFirst.mockResolvedValue({ name: 'Agent One' });
    mockActivityStatusFindMany.mockResolvedValue([makeActivityStatus()]);
    mockFindMany.mockResolvedValue([open]);
    mockFindFirst.mockResolvedValue(open);

    const result = await getMyDayService(USER_ID, ORG_ID, '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activeSession?.activeSegment?.id).toBe('open-seg');
      expect(result.data.shifts[0]?.status).toBe('active');
    }
  });

  it('queries day boundaries using the organization timezone', async () => {
    mockOrganizationFindUnique.mockResolvedValue({ timezone: 'America/New_York' });
    mockUserFindFirst.mockResolvedValue({ name: 'Agent One' });
    mockActivityStatusFindMany.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(null);

    await getMyDayService(USER_ID, ORG_ID, '2026-06-10');

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startTime: {
            gte: new Date('2026-06-10T04:00:00.000Z'),
            lte: new Date('2026-06-11T03:59:59.999Z'),
          },
        }),
      })
    );
  });

  it('fails when target userId is not a member of organizationId', async () => {
    tenantFailure();

    const result = await getMyDayService(USER_ID, ORG_ID, '2026-06-10');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY);
    }
  });
});

describe('time-tracking tenant isolation', () => {
  it('clockInService rejects userId that is not in organizationId membership', async () => {
    tenantFailure();

    const result = await clockInService(USER_ID, ORG_ID);

    expect(result.success).toBe(false);
    expect(mockResolveOrganizationContext).toHaveBeenCalledWith(USER_ID, ORG_ID);
  });

  it('setStatusService rejects activityStatusId from a different organization', async () => {
    mockFindFirst.mockResolvedValue(makeTimeLogSegment());
    mockResolveActivityStatus.mockResolvedValue({
      success: false,
      error: {
        code: TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
        message: 'Activity status not found for this organization.',
      },
    });

    const result = await setStatusService(USER_ID, ORG_ID, 'other-org-status');

    expect(result.success).toBe(false);
    expect(mockResolveActivityStatus).toHaveBeenCalledWith(ORG_ID, 'other-org-status', undefined);
  });
});
