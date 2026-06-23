import { MemberStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  isLunchStatusName,
  resolveComplianceLimits,
} from '@/lib/organization/compliance-limits';
import {
  assertOrganizationId,
  withOrganizationScope,
} from '@/lib/security/organization-context';
import { ServiceResult } from '@/lib/types/api-response';
import {
  formatDurationHuman,
  formatDurationHours,
  formatTimeLocal,
} from '@/lib/utils/admin-metrics';
import { AVAILABLE_STATUS_NAME, isBreakType, isProductiveType } from '@/lib/utils/status-type';
import {
  getOrganizationDateRange,
  getOrganizationDayRange,
  getOrganizationLocalDateString,
  getOrganizationTodayDateString,
  resolveOrganizationTimezone,
} from '@/lib/utils/date-helpers';
import { segmentDurationMs, utcNow } from '@/lib/utils/time';

const segmentInclude = {
  activityStatus: {
    select: { name: true, type: true, colorCode: true },
  },
  user: { select: { id: true, name: true } },
} as const;

function isoField(value: Date): string {
  return value.toISOString();
}

export interface AdminKpis {
  activeShiftCount: number;
  onBreakCount: number;
  availableCount: number;
  offFloorCount: number;
  totalRegistered: number;
}

export interface StatusBreakdownItem {
  name: string;
  count: number;
  isProductive: boolean;
}

export interface FloorAgentRow {
  userId: string;
  employeeName: string;
  timeLogId: string | null;
  clockIn: string | null;
  displayStatus: string;
  isProductive: boolean | null;
  statusSince: string | null;
  breakToday: string;
  isOnShift: boolean;
}

export interface ComplianceAlert {
  userId: string;
  employeeName: string;
  timeLogId: string;
  clockIn: string;
  elapsedHours: number;
  message: string;
  severity: 'warning' | 'critical';
}

export interface AdminOverviewData {
  kpis: AdminKpis;
  statusBreakdown: StatusBreakdownItem[];
  floorAgents: FloorAgentRow[];
  complianceAlerts: ComplianceAlert[];
}

export interface TimesheetRow {
  timeLogId: string;
  userId: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  clockInFormatted: string;
  clockOutFormatted: string;
  breakDeductions: string;
  netWorkHours: string;
  manuallyEdited: boolean;
}

export async function getAdminOverviewService(
  organizationId: string
): Promise<ServiceResult<AdminOverviewData>> {
  assertOrganizationId(organizationId, 'getAdminOverviewService');

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, timezone: true, metadata: true },
  });
  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  const timezone = resolveOrganizationTimezone(organization.timezone);
  const complianceLimits = resolveComplianceLimits(organization);
  const now = utcNow();
  const nowMs = now.getTime();
  const { rangeStart: todayStart } = getOrganizationDayRange(
    timezone,
    getOrganizationTodayDateString(timezone, now)
  );

  const [members, openSegments, todaySegments] = await Promise.all([
    prisma.member.findMany({
      where: withOrganizationScope(organizationId, { status: MemberStatus.ACTIVE }),
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.timeLog.findMany({
      where: withOrganizationScope(organizationId, { endTime: null }),
      include: segmentInclude,
      orderBy: { startTime: 'asc' },
    }),
    prisma.timeLog.findMany({
      where: withOrganizationScope(organizationId, {
        startTime: { gte: todayStart },
      }),
      include: {
        activityStatus: { select: { type: true } },
      },
    }),
  ]);

  const activeUserIds = new Set(members.map((member) => member.userId));
  const activeOpenSegments = openSegments.filter((segment) =>
    activeUserIds.has(segment.userId)
  );

  const openByUserId = new Map(activeOpenSegments.map((segment) => [segment.userId, segment]));

  const breakTodayByUser = new Map<string, number>();
  for (const segment of todaySegments) {
    if (!isBreakType(segment.activityStatus.type)) continue;
    const current = breakTodayByUser.get(segment.userId) ?? 0;
    breakTodayByUser.set(
      segment.userId,
      current + segmentDurationMs(segment.startTime, segment.endTime, now)
    );
  }

  const shiftStartByUserId = await batchFirstSegmentStarts(
    organizationId,
    activeOpenSegments,
    timezone
  );

  const floorAgents: FloorAgentRow[] = members.map((member) => {
    const open = openByUserId.get(member.userId);

    if (!open) {
      return {
        userId: member.user.id,
        employeeName: member.user.name,
        timeLogId: null,
        clockIn: null,
        displayStatus: 'Clocked Out',
        isProductive: null,
        statusSince: null,
        breakToday: formatDurationHuman(breakTodayByUser.get(member.userId) ?? 0),
        isOnShift: false,
      };
    }

    const shiftStart = shiftStartByUserId.get(member.userId) ?? open.startTime;

    return {
      userId: member.user.id,
      employeeName: member.user.name,
      timeLogId: open.id,
      clockIn: isoField(shiftStart),
      displayStatus: open.activityStatus.name,
      isProductive: isProductiveType(open.activityStatus.type),
      statusSince: isoField(open.startTime),
      breakToday: formatDurationHuman(breakTodayByUser.get(member.userId) ?? 0),
      isOnShift: true,
    };
  });

  let availableCount = 0;
  let onBreakCount = 0;
  const statusCountMap = new Map<string, StatusBreakdownItem>();

  for (const agent of floorAgents) {
    if (!agent.isOnShift) continue;

    if (agent.displayStatus === AVAILABLE_STATUS_NAME) {
      availableCount += 1;
      continue;
    }

    if (agent.isProductive === false) {
      onBreakCount += 1;
    }

    const existing = statusCountMap.get(agent.displayStatus);
    if (existing) {
      existing.count += 1;
    } else {
      statusCountMap.set(agent.displayStatus, {
        name: agent.displayStatus,
        count: 1,
        isProductive: agent.isProductive === true,
      });
    }
  }

  const offFloorCount = floorAgents.filter((agent) => !agent.isOnShift).length;

  const statusBreakdown: StatusBreakdownItem[] = [
    { name: AVAILABLE_STATUS_NAME, count: availableCount, isProductive: true },
    ...[...statusCountMap.values()]
      .filter((item) => item.name !== AVAILABLE_STATUS_NAME)
      .sort((left, right) => left.name.localeCompare(right.name)),
    { name: 'Off Floor', count: offFloorCount, isProductive: false },
  ];

  const complianceAlerts: ComplianceAlert[] = [];

  for (const open of activeOpenSegments) {
    const shiftStart = shiftStartByUserId.get(open.userId) ?? open.startTime;
    const clockInIso = isoField(shiftStart);
    const elapsedMs = nowMs - shiftStart.getTime();

    if (elapsedMs > complianceLimits.maxShiftDurationMs) {
      complianceAlerts.push({
        userId: open.user.id,
        employeeName: open.user.name,
        timeLogId: open.id,
        clockIn: clockInIso,
        elapsedHours: Math.round((elapsedMs / (1000 * 60 * 60)) * 10) / 10,
        message: 'Potential missed clock-out detected',
        severity: 'critical',
      });
    }

    if (isBreakType(open.activityStatus.type)) {
      const statusElapsedMs = nowMs - open.startTime.getTime();
      const breakThresholdMs = isLunchStatusName(open.activityStatus.name)
        ? complianceLimits.maxLunchDurationMs
        : complianceLimits.maxBreakDurationMs;

      if (statusElapsedMs > breakThresholdMs) {
        complianceAlerts.push({
          userId: open.user.id,
          employeeName: open.user.name,
          timeLogId: open.id,
          clockIn: clockInIso,
          elapsedHours: Math.round((statusElapsedMs / (1000 * 60 * 60)) * 10) / 10,
          message: `Extended ${open.activityStatus.name.toLowerCase()} (${formatDurationHuman(statusElapsedMs)})`,
          severity: 'warning',
        });
      }
    }
  }

  return {
    success: true,
    data: {
      kpis: {
        activeShiftCount: activeOpenSegments.length,
        onBreakCount,
        availableCount,
        offFloorCount,
        totalRegistered: members.length,
      },
      statusBreakdown,
      floorAgents,
      complianceAlerts,
    },
  };
}

/**
 * Resolves each open agent's shift clock-in (first segment on the org-local day
 * of their current open segment) in one round-trip: a single findMany from the
 * earliest per-user day boundary, then in-memory min startTime per user.
 */
async function batchFirstSegmentStarts(
  organizationId: string,
  openSegments: Array<{ userId: string; startTime: Date }>,
  timezone: string
): Promise<Map<string, Date>> {
  if (openSegments.length === 0) {
    return new Map();
  }

  const dayStartByUserId = new Map<string, Date>();
  let earliestDayStartMs = Number.POSITIVE_INFINITY;

  for (const segment of openSegments) {
    const localDate = getOrganizationLocalDateString(segment.startTime, timezone);
    const { rangeStart: dayStart } = getOrganizationDayRange(timezone, localDate);
    dayStartByUserId.set(segment.userId, dayStart);
    earliestDayStartMs = Math.min(earliestDayStartMs, dayStart.getTime());
  }

  const userIds = [...dayStartByUserId.keys()];
  const segments = await prisma.timeLog.findMany({
    where: withOrganizationScope(organizationId, {
      userId: { in: userIds },
      startTime: { gte: new Date(earliestDayStartMs) },
    }),
    select: { userId: true, startTime: true },
    orderBy: { startTime: 'asc' },
  });

  const segmentsByUserId = new Map<string, Date[]>();
  for (const segment of segments) {
    const bucket = segmentsByUserId.get(segment.userId) ?? [];
    bucket.push(segment.startTime);
    segmentsByUserId.set(segment.userId, bucket);
  }

  const shiftStartByUserId = new Map<string, Date>();
  for (const open of openSegments) {
    const dayStart = dayStartByUserId.get(open.userId)!;
    const dayStartMs = dayStart.getTime();
    const userSegments = segmentsByUserId.get(open.userId) ?? [];
    const firstOnDay = userSegments.find((startTime) => startTime.getTime() >= dayStartMs);
    shiftStartByUserId.set(open.userId, firstOnDay ?? open.startTime);
  }

  return shiftStartByUserId;
}

export async function getTimesheetsService(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<ServiceResult<{ rows: TimesheetRow[] }>> {
  assertOrganizationId(organizationId, 'getTimesheetsService');

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, timezone: true },
  });
  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  const timezone = resolveOrganizationTimezone(organization.timezone);
  const { rangeStart, rangeEnd } = getOrganizationDateRange(timezone, startDate, endDate);

  if (rangeStart > rangeEnd) {
    return fail(TimeTrackingErrorCodes.VALIDATION_ERROR, 'startDate must be before endDate.');
  }

  const segments = await prisma.timeLog.findMany({
    where: withOrganizationScope(organizationId, {
      startTime: { gte: rangeStart, lte: rangeEnd },
    }),
    include: {
      user: { select: { id: true, name: true } },
      activityStatus: { select: { type: true } },
    },
    orderBy: { startTime: 'desc' },
  });

  const segmentIds = segments.map((segment) => segment.id);
  const auditedTimeLogIds = new Set(
    segmentIds.length === 0
      ? []
      : (
          await prisma.timeLogAudit.findMany({
            where: {
              organizationId,
              timeLogId: { in: segmentIds },
            },
            select: { timeLogId: true },
            distinct: ['timeLogId'],
          })
        ).map((row) => row.timeLogId)
  );

  const grouped = new Map<string, typeof segments>();

  for (const segment of segments) {
    const dayKey = `${segment.userId}:${getOrganizationLocalDateString(segment.startTime, timezone)}`;
    const bucket = grouped.get(dayKey) ?? [];
    bucket.push(segment);
    grouped.set(dayKey, bucket);
  }

  const rows: TimesheetRow[] = [];

  for (const [, daySegments] of grouped) {
    const sorted = [...daySegments].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const clockInIso = isoField(first.startTime);
    const clockOutIso = last.endTime ? isoField(last.endTime) : null;
    const endMs = last.endTime?.getTime() ?? Date.now();
    const grossMs = Math.max(0, endMs - first.startTime.getTime());
    const breakMs = sorted.reduce((total, segment) => {
      if (isProductiveType(segment.activityStatus.type)) return total;
      return total + segmentDurationMs(segment.startTime, segment.endTime);
    }, 0);

    rows.push({
      timeLogId: first.id,
      userId: first.user.id,
      employeeName: first.user.name,
      date: clockInIso,
      clockIn: clockInIso,
      clockOut: clockOutIso,
      clockInFormatted: formatTimeLocal(clockInIso),
      clockOutFormatted: clockOutIso ? formatTimeLocal(clockOutIso) : '—',
      breakDeductions: formatDurationHuman(breakMs),
      netWorkHours: formatDurationHours(Math.max(0, grossMs - breakMs)),
      manuallyEdited: sorted.some((segment) => auditedTimeLogIds.has(segment.id)),
    });
  }

  rows.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

  return { success: true, data: { rows } };
}
