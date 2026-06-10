import { StatusType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  resolveActivityStatus,
  resolveAvailableStatus,
} from '@/lib/security/activity-status';
import { resolveOrganizationContext } from '@/lib/security/organization-context';
import { ServiceResult } from '@/lib/types/api-response';
import {
  formatDurationHuman,
  formatDurationHours,
  formatTimeLocal,
} from '@/lib/utils/admin-metrics';
import { isProductiveType } from '@/lib/utils/status-type';
import {
  computeDaySummaryFromSegments,
  segmentDurationMs,
  serializeTimeLogSegment,
  utcNow,
} from '@/lib/utils/time';

const segmentInclude = {
  activityStatus: {
    select: {
      id: true,
      name: true,
      type: true,
      colorCode: true,
      isBillable: true,
    },
  },
} as const;

export interface TimeLogSegment {
  id: string;
  userId: string;
  organizationId: string;
  activityStatusId: string;
  statusName: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
  isProductive: boolean;
  startTime: string;
  endTime: string | null;
  notes: string | null;
}

export interface ActiveSession {
  activeSegment: TimeLogSegment | null;
}

export interface MyDayShiftRow {
  timeLogId: string;
  clockIn: string;
  clockOut: string | null;
  clockInFormatted: string;
  clockOutFormatted: string;
  status: 'active' | 'closed';
  breakDeductions: string;
  netWorkHours: string;
  notes: string;
}

export interface MyDayActivityRow {
  id: string;
  timeLogId: string;
  shiftClockInFormatted: string;
  statusName: string;
  startTime: string;
  endTime: string | null;
  startFormatted: string;
  endFormatted: string;
  duration: string;
}

export interface MyDayTimelineEvent {
  id: string;
  time: string;
  timeFormatted: string;
  label: string;
  duration: string;
  isProductive: boolean | null;
  kind: 'shift_start' | 'shift_end' | 'status';
}

export interface MyDaySummary {
  gross: string;
  breaks: string;
  net: string;
}

export interface MyDayData {
  employeeName: string;
  date: string;
  activeSession: ActiveSession | null;
  activityStatuses: {
    id: string;
    name: string;
    type: StatusType;
    colorCode: string;
    isBillable: boolean;
    isProductive: boolean;
  }[];
  shifts: MyDayShiftRow[];
  activities: MyDayActivityRow[];
  timeline: MyDayTimelineEvent[];
  summary: MyDaySummary;
}

function isoField(value: Date): string {
  return value.toISOString();
}

function activityDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  return formatDurationHuman(Math.max(0, end - start));
}

function resolveDateRange(date: string): { rangeStart: Date; rangeEnd: Date } {
  return {
    rangeStart: new Date(`${date}T00:00:00.000Z`),
    rangeEnd: new Date(`${date}T23:59:59.999Z`),
  };
}

async function findOpenSegment(userId: string, organizationId: string) {
  return prisma.timeLog.findFirst({
    where: { userId, organizationId, endTime: null },
    include: segmentInclude,
    orderBy: { startTime: 'desc' },
  });
}

function toSegment(
  segment: Awaited<ReturnType<typeof findOpenSegment>>
): TimeLogSegment | null {
  if (!segment) return null;
  return serializeTimeLogSegment(segment) as TimeLogSegment;
}

export async function clockInService(
  userId: string,
  organizationId: string,
  notes?: string
): Promise<ServiceResult<{ segment: TimeLogSegment }>> {
  const tenantResult = await resolveOrganizationContext(userId, organizationId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;
  const openSegment = await findOpenSegment(tenant.userId, tenant.organizationId);

  if (openSegment) {
    return fail(
      TimeTrackingErrorCodes.USER_ALREADY_CLOCKED_IN,
      'User already has an active clock-in session.'
    );
  }

  const availableResult = await resolveAvailableStatus(tenant.organizationId);
  if (!availableResult.success) return availableResult;

  const segment = await prisma.timeLog.create({
    data: {
      userId: tenant.userId,
      organizationId: tenant.organizationId,
      activityStatusId: availableResult.data.id,
      notes: notes ?? null,
    },
    include: segmentInclude,
  });

  return { success: true, data: { segment: toSegment(segment)! } };
}

export async function clockOutService(
  userId: string,
  organizationId: string
): Promise<ServiceResult<{ segment: TimeLogSegment }>> {
  const tenantResult = await resolveOrganizationContext(userId, organizationId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;
  const openSegment = await findOpenSegment(tenant.userId, tenant.organizationId);

  if (!openSegment) {
    return fail(
      TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND,
      'No active clock-in session found for this user.'
    );
  }

  const now = utcNow();
  const closed = await prisma.timeLog.update({
    where: { id: openSegment.id },
    data: { endTime: now },
    include: segmentInclude,
  });

  return { success: true, data: { segment: toSegment(closed)! } };
}

export async function setStatusService(
  userId: string,
  organizationId: string,
  statusId?: string,
  statusName?: string
): Promise<ServiceResult<{ segment: TimeLogSegment | null }>> {
  const tenantResult = await resolveOrganizationContext(userId, organizationId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;
  const openSegment = await findOpenSegment(tenant.userId, tenant.organizationId);

  if (!openSegment) {
    return fail(
      TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND,
      'No active clock-in session found for this user.'
    );
  }

  const now = utcNow();

  let targetStatus;
  if (!statusId && !statusName) {
    const availableResult = await resolveAvailableStatus(tenant.organizationId);
    if (!availableResult.success) return availableResult;
    targetStatus = availableResult.data;
  } else {
    const statusResult = await resolveActivityStatus(
      tenant.organizationId,
      statusId,
      statusName
    );
    if (!statusResult.success) return statusResult;
    targetStatus = statusResult.data;
  }

  if (openSegment.activityStatusId === targetStatus.id) {
    return { success: true, data: { segment: toSegment(openSegment) } };
  }

  const newSegment = await prisma.$transaction(async (tx) => {
    await tx.timeLog.update({
      where: { id: openSegment.id },
      data: { endTime: now },
    });

    return tx.timeLog.create({
      data: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        activityStatusId: targetStatus.id,
      },
      include: segmentInclude,
    });
  });

  return { success: true, data: { segment: toSegment(newSegment) } };
}

type TimelineSegment = Awaited<
  ReturnType<
    typeof prisma.timeLog.findMany<{
      include: typeof segmentInclude;
    }>
  >
>[number];

function buildTimeline(segments: TimelineSegment[], hasOpenSegment: boolean): MyDayTimelineEvent[] {
  if (segments.length === 0) return [];

  const events: MyDayTimelineEvent[] = [];
  const first = segments[0];
  const firstStart = isoField(first.startTime);

  events.push({
    id: `${first.id}-start`,
    time: firstStart,
    timeFormatted: formatTimeLocal(firstStart),
    label: 'Shift started',
    duration: '—',
    isProductive: null,
    kind: 'shift_start',
  });

  for (const segment of segments) {
    const serialized = serializeTimeLogSegment(segment);
    events.push({
      id: segment.id,
      time: serialized.startTime,
      timeFormatted: formatTimeLocal(serialized.startTime),
      label: serialized.statusName,
      duration: activityDuration(serialized.startTime, serialized.endTime),
      isProductive: serialized.isProductive,
      kind: 'status',
    });
  }

  if (!hasOpenSegment && segments.length > 0) {
    const last = segments[segments.length - 1];
    if (last.endTime) {
      const endIso = isoField(last.endTime);
      events.push({
        id: `${last.id}-end`,
        time: endIso,
        timeFormatted: formatTimeLocal(endIso),
        label: 'Shift ended',
        duration: '—',
        isProductive: null,
        kind: 'shift_end',
      });
    }
  }

  return events;
}

export async function getMyDayService(
  userId: string,
  organizationId: string,
  date?: string
): Promise<ServiceResult<MyDayData>> {
  const tenantResult = await resolveOrganizationContext(userId, organizationId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;
  const resolvedDate = date ?? utcNow().toISOString().slice(0, 10);
  const { rangeStart, rangeEnd } = resolveDateRange(resolvedDate);

  const [user, activityStatuses, daySegments, openSegment] = await Promise.all([
    prisma.user.findFirst({
      where: { id: tenant.userId },
      select: { name: true },
    }),
    prisma.activityStatus.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { name: 'asc' },
    }),
    prisma.timeLog.findMany({
      where: {
        userId: tenant.userId,
        organizationId: tenant.organizationId,
        startTime: { gte: rangeStart, lte: rangeEnd },
      },
      include: segmentInclude,
      orderBy: { startTime: 'asc' },
    }),
    findOpenSegment(tenant.userId, tenant.organizationId),
  ]);

  if (!user) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Employee not found.');
  }

  let effectiveSegments = [...daySegments];
  if (openSegment && !effectiveSegments.some((s) => s.id === openSegment.id)) {
    effectiveSegments = [openSegment, ...effectiveSegments];
  }

  const activeSession: ActiveSession | null = openSegment
    ? { activeSegment: toSegment(openSegment) }
    : null;

  const firstStart = effectiveSegments[0]?.startTime;
  const lastSegment = effectiveSegments[effectiveSegments.length - 1];
  const shiftId = effectiveSegments[0]?.id ?? 'day';

  const breakMs = effectiveSegments.reduce((total, segment) => {
    if (isProductiveType(segment.activityStatus.type)) return total;
    return total + segmentDurationMs(segment.startTime, segment.endTime);
  }, 0);

  const grossMs =
    effectiveSegments.length > 0 && firstStart
      ? segmentDurationMs(
          firstStart,
          lastSegment?.endTime ?? null,
          openSegment ? utcNow() : utcNow()
        )
      : 0;

  const shifts: MyDayShiftRow[] =
    effectiveSegments.length > 0 && firstStart
      ? [
          {
            timeLogId: shiftId,
            clockIn: isoField(firstStart),
            clockOut: lastSegment?.endTime ? isoField(lastSegment.endTime) : null,
            clockInFormatted: formatTimeLocal(isoField(firstStart)),
            clockOutFormatted: lastSegment?.endTime
              ? formatTimeLocal(isoField(lastSegment.endTime))
              : 'Active',
            status: openSegment ? 'active' : 'closed',
            breakDeductions: formatDurationHuman(breakMs),
            netWorkHours: formatDurationHours(Math.max(0, grossMs - breakMs)),
            notes: effectiveSegments.map((s) => s.notes).filter(Boolean).join('; ') || '',
          },
        ]
      : [];

  const dayStartFormatted =
    effectiveSegments.length > 0 ? formatTimeLocal(isoField(effectiveSegments[0].startTime)) : '—';

  const activities: MyDayActivityRow[] = effectiveSegments.map((segment) => {
    const serialized = serializeTimeLogSegment(segment);
    return {
      id: segment.id,
      timeLogId: shiftId,
      shiftClockInFormatted: dayStartFormatted,
      statusName: serialized.statusName,
      startTime: serialized.startTime,
      endTime: serialized.endTime,
      startFormatted: formatTimeLocal(serialized.startTime),
      endFormatted: serialized.endTime ? formatTimeLocal(serialized.endTime) : 'Active',
      duration: activityDuration(serialized.startTime, serialized.endTime),
    };
  });

  return {
    success: true,
    data: {
      employeeName: user.name,
      date: resolvedDate,
      activeSession,
      activityStatuses: activityStatuses.map((status) => ({
        id: status.id,
        name: status.name,
        type: status.type,
        colorCode: status.colorCode,
        isBillable: status.isBillable,
        isProductive: isProductiveType(status.type),
      })),
      shifts,
      activities,
      timeline: buildTimeline(effectiveSegments, Boolean(openSegment)),
      summary: computeDaySummaryFromSegments(
        effectiveSegments,
        formatDurationHuman,
        formatDurationHours
      ),
    },
  };
}
