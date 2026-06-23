import { StatusType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ORG_ID, USER_ID, makeActivityStatus } from '@/test/fixtures/time-log';

const {
  mockOrgFindUnique,
  mockTimeLogFindMany,
  mockTimeLogFindFirst,
  mockTimeLogAuditFindMany,
  mockMemberFindMany,
  mockUtcNow,
} = vi.hoisted(() => ({
  mockOrgFindUnique: vi.fn(),
  mockTimeLogFindMany: vi.fn(),
  mockTimeLogFindFirst: vi.fn(),
  mockTimeLogAuditFindMany: vi.fn(),
  mockMemberFindMany: vi.fn(),
  mockUtcNow: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    organization: {
      findUnique: mockOrgFindUnique,
    },
    timeLog: {
      findMany: mockTimeLogFindMany,
      findFirst: mockTimeLogFindFirst,
    },
    timeLogAudit: {
      findMany: mockTimeLogAuditFindMany,
    },
    member: {
      findMany: mockMemberFindMany,
    },
  },
}));

vi.mock('@/lib/utils/time', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/time')>();
  return {
    ...actual,
    utcNow: mockUtcNow,
  };
});

import {
  getAdminOverviewService,
  getTimesheetsService,
} from '@/lib/services/admin-dashboard.service';

const FIXED_NOW = new Date('2026-06-10T15:00:00.000Z');

function makeTimesheetSegment(
  overrides: Partial<{
    id: string;
    userId: string;
    startTime: Date;
    endTime: Date | null;
    type: StatusType;
    userName: string;
  }> = {}
) {
  const type = overrides.type ?? StatusType.PRODUCTIVE;
  return {
    id: overrides.id ?? 'seg-1',
    userId: overrides.userId ?? USER_ID,
    organizationId: ORG_ID,
    activityStatusId: 'status-1',
    startTime: overrides.startTime ?? new Date('2026-06-10T09:00:00.000Z'),
    endTime:
      overrides.endTime !== undefined
        ? overrides.endTime
        : new Date('2026-06-10T17:00:00.000Z'),
    notes: null,
    user: { id: overrides.userId ?? USER_ID, name: overrides.userName ?? 'Agent One' },
    activityStatus: { type },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUtcNow.mockReturnValue(FIXED_NOW);
  mockOrgFindUnique.mockResolvedValue({
    id: ORG_ID,
    name: 'Acme',
    timezone: 'UTC',
    metadata: JSON.stringify({ allowedDomains: ['acme.com'] }),
  });
  mockTimeLogAuditFindMany.mockResolvedValue([]);
});

describe('getTimesheetsService', () => {
  it('returns VALIDATION_ERROR when startDate is after endDate', async () => {
    const result = await getTimesheetsService(ORG_ID, '2026-06-12', '2026-06-10');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.VALIDATION_ERROR);
    }
    expect(mockTimeLogFindMany).not.toHaveBeenCalled();
  });

  it('returns USER_NOT_IN_COMPANY when organization does not exist', async () => {
    mockOrgFindUnique.mockResolvedValue(null);

    const result = await getTimesheetsService(ORG_ID, '2026-06-01', '2026-06-10');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY);
    }
  });

  it('scopes query to organizationId only (no cross-tenant segments)', async () => {
    mockTimeLogFindMany.mockResolvedValue([]);

    await getTimesheetsService(ORG_ID, '2026-06-01', '2026-06-10');

    expect(mockTimeLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: ORG_ID }),
      })
    );
  });

  it('groups segments by userId + UTC date into a single timesheet row', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T10:00:00.000Z'),
      }),
      makeTimesheetSegment({
        id: 'seg-2',
        startTime: new Date('2026-06-10T10:30:00.000Z'),
        endTime: new Date('2026-06-10T11:30:00.000Z'),
        type: StatusType.BREAK,
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]?.employeeName).toBe('Agent One');
    }
  });

  it('uses earliest segment start as clockIn and latest end as clockOut', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'seg-late',
        startTime: new Date('2026-06-10T13:00:00.000Z'),
        endTime: new Date('2026-06-10T14:00:00.000Z'),
      }),
      makeTimesheetSegment({
        id: 'seg-early',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T10:00:00.000Z'),
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      const row = result.data.rows[0];
      expect(row?.clockIn).toBe(new Date('2026-06-10T09:00:00.000Z').toISOString());
      expect(row?.clockOut).toBe(new Date('2026-06-10T14:00:00.000Z').toISOString());
    }
  });

  it('sums only non-productive segment durations into breakDeductions', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T11:00:00.000Z'),
        type: StatusType.PRODUCTIVE,
      }),
      makeTimesheetSegment({
        id: 'seg-2',
        startTime: new Date('2026-06-10T11:00:00.000Z'),
        endTime: new Date('2026-06-10T11:30:00.000Z'),
        type: StatusType.BREAK,
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[0]?.breakDeductions).toBe('30m');
    }
  });

  it('computes netWorkHours as grossMs minus breakMs', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T10:00:00.000Z'),
        type: StatusType.PRODUCTIVE,
      }),
      makeTimesheetSegment({
        id: 'seg-2',
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: new Date('2026-06-10T10:30:00.000Z'),
        type: StatusType.BREAK,
      }),
      makeTimesheetSegment({
        id: 'seg-3',
        startTime: new Date('2026-06-10T10:30:00.000Z'),
        endTime: new Date('2026-06-10T11:00:00.000Z'),
        type: StatusType.PRODUCTIVE,
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[0]?.netWorkHours).toBe('1.50');
    }
  });

  it('treats open last segment as active through Date.now for net hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T10:00:00.000Z'),
        type: StatusType.PRODUCTIVE,
      }),
      makeTimesheetSegment({
        id: 'seg-open',
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: null,
        type: StatusType.PRODUCTIVE,
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    vi.useRealTimers();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[0]?.clockOut).toBeNull();
      expect(result.data.rows[0]?.clockOutFormatted).toBe('—');
      expect(result.data.rows[0]?.netWorkHours).toBe('6.00');
    }
  });

  it('sorts rows by clockIn descending', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'day-1',
        userId: USER_ID,
        startTime: new Date('2026-06-09T09:00:00.000Z'),
        endTime: new Date('2026-06-09T17:00:00.000Z'),
      }),
      makeTimesheetSegment({
        id: 'day-2',
        userId: USER_ID,
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T17:00:00.000Z'),
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-01', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[0]?.timeLogId).toBe('day-2');
      expect(result.data.rows[1]?.timeLogId).toBe('day-1');
    }
  });

  it('returns empty rows when no segments in range', async () => {
    mockTimeLogFindMany.mockResolvedValue([]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-01', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toEqual([]);
    }
  });
});

describe('getTimesheetsService edge cases', () => {
  it('handles multiple status changes same day without duplicating rows', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({ id: 'seg-1', startTime: new Date('2026-06-10T09:00:00.000Z'), endTime: new Date('2026-06-10T10:00:00.000Z') }),
      makeTimesheetSegment({ id: 'seg-2', startTime: new Date('2026-06-10T10:00:00.000Z'), endTime: new Date('2026-06-10T10:15:00.000Z'), type: StatusType.BREAK }),
      makeTimesheetSegment({ id: 'seg-3', startTime: new Date('2026-06-10T10:15:00.000Z'), endTime: new Date('2026-06-10T12:00:00.000Z') }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toHaveLength(1);
    }
  });

  it('does not count PRODUCTIVE segments toward breakDeductions', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T12:00:00.000Z'),
        type: StatusType.TRAINING,
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[0]?.breakDeductions).toBe('0m');
    }
  });

  it('handles single-segment day with zero breaks', async () => {
    mockTimeLogFindMany.mockResolvedValue([
      makeTimesheetSegment({
        id: 'seg-1',
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T12:00:00.000Z'),
        type: StatusType.PRODUCTIVE,
      }),
    ]);

    const result = await getTimesheetsService(ORG_ID, '2026-06-10', '2026-06-10');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows[0]?.breakDeductions).toBe('0m');
      expect(result.data.rows[0]?.netWorkHours).toBe('3.00');
    }
  });
});

describe('getAdminOverviewService complianceAlerts', () => {
  beforeEach(() => {
    mockMemberFindMany.mockResolvedValue([
      { userId: USER_ID, user: { id: USER_ID, name: 'Agent One' } },
    ]);
  });

  it('emits critical alert when open shift exceeds 12 hours', async () => {
    const longShiftStart = new Date(FIXED_NOW.getTime() - 13 * 60 * 60 * 1000);
    mockTimeLogFindMany
      .mockResolvedValueOnce([
        {
          id: 'open-1',
          userId: USER_ID,
          organizationId: ORG_ID,
          startTime: longShiftStart,
          endTime: null,
          activityStatus: makeActivityStatus(),
          user: { id: USER_ID, name: 'Agent One' },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: USER_ID, startTime: longShiftStart }]);

    const result = await getAdminOverviewService(ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.complianceAlerts.some((alert) => alert.severity === 'critical')).toBe(
        true
      );
      expect(result.data.complianceAlerts[0]?.message).toBe(
        'Potential missed clock-out detected'
      );
    }
  });

  it('emits warning when break status exceeds 30 minutes', async () => {
    const breakStart = new Date(FIXED_NOW.getTime() - 45 * 60 * 1000);
    mockTimeLogFindMany
      .mockResolvedValueOnce([
        {
          id: 'open-break',
          userId: USER_ID,
          organizationId: ORG_ID,
          startTime: breakStart,
          endTime: null,
          activityStatus: makeActivityStatus({
            name: 'Lunch',
            type: StatusType.BREAK,
          }),
          user: { id: USER_ID, name: 'Agent One' },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: USER_ID, startTime: breakStart }]);

    const result = await getAdminOverviewService(ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.complianceAlerts.some((alert) => alert.severity === 'warning')).toBe(true);
      expect(result.data.complianceAlerts[0]?.message).toContain('Extended lunch');
    }
  });

  it('uses org-specific maxShiftHours from metadata', async () => {
    mockOrgFindUnique.mockResolvedValue({
      id: ORG_ID,
      name: 'Acme',
      timezone: 'UTC',
      metadata: JSON.stringify({ allowedDomains: ['acme.com'], maxShiftHours: 8 }),
    });

    const shiftStart = new Date(FIXED_NOW.getTime() - 9 * 60 * 60 * 1000);
    mockTimeLogFindMany
      .mockResolvedValueOnce([
        {
          id: 'open-1',
          userId: USER_ID,
          organizationId: ORG_ID,
          startTime: shiftStart,
          endTime: null,
          activityStatus: makeActivityStatus(),
          user: { id: USER_ID, name: 'Agent One' },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: USER_ID, startTime: shiftStart }]);

    const result = await getAdminOverviewService(ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.complianceAlerts.some((alert) => alert.severity === 'critical')).toBe(true);
    }
  });

  it('applies separate lunch and break thresholds from metadata', async () => {
    mockOrgFindUnique.mockResolvedValue({
      id: ORG_ID,
      name: 'Acme',
      timezone: 'UTC',
      metadata: JSON.stringify({
        allowedDomains: ['acme.com'],
        maxBreakMinutes: 10,
        maxLunchMinutes: 60,
      }),
    });

    const shortBreakStart = new Date(FIXED_NOW.getTime() - 20 * 60 * 1000);
    mockTimeLogFindMany
      .mockResolvedValueOnce([
        {
          id: 'open-short-break',
          userId: USER_ID,
          organizationId: ORG_ID,
          startTime: shortBreakStart,
          endTime: null,
          activityStatus: makeActivityStatus({
            name: 'Short Break',
            type: StatusType.BREAK,
          }),
          user: { id: USER_ID, name: 'Agent One' },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ userId: USER_ID, startTime: shortBreakStart }]);

    const result = await getAdminOverviewService(ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.complianceAlerts.some((alert) => alert.severity === 'warning')).toBe(true);
      expect(result.data.complianceAlerts[0]?.message).toContain('Extended short break');
    }
  });

  it('does not alert for clocked-out agents', async () => {
    mockTimeLogFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getAdminOverviewService(ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.complianceAlerts).toEqual([]);
      expect(result.data.kpis.activeShiftCount).toBe(0);
    }
  });
});
