import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { resolveActivityStatus } from '@/lib/security/activity-status';
import {
  assertTimeLogTenantScope,
  resolveTenantContext,
} from '@/lib/security/tenant-context';
import { ServiceResult } from '@/lib/types/api-response';
import {
  computeNetWorkMinutes,
  serializeActivityLog,
  serializeTimeLog,
  utcNow,
} from '@/lib/utils/time';
import {
  computeSessionMetrics,
  formatDurationHuman,
  formatDurationHours,
  formatNetWorkMinutes,
  formatTimeLocal,
} from '@/lib/utils/admin-metrics';

export interface ClockInMetadata {
  clockInIp?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string;
}

export interface ClockOutMetadata {
  clockOutIp?: string | null;
}

type SerializedTimeLog = ReturnType<typeof serializeTimeLog>;
type SerializedActivityLog = ReturnType<typeof serializeActivityLog>;

export interface ActiveSession {
  timeLog: SerializedTimeLog;
  activeActivity: SerializedActivityLog | null;
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
  activityStatuses: { id: string; name: string; isProductive: boolean }[];
  shifts: MyDayShiftRow[];
  activities: MyDayActivityRow[];
  timeline: MyDayTimelineEvent[];
  summary: MyDaySummary;
}

function isoField(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

function isoFieldOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoField(value);
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

const activityLogInclude = {
  status: {
    select: {
      id: true,
      name: true,
      isProductive: true,
    },
  },
} as const;

function toDecimal(value: number | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

export async function clockInService(
  userId: string,
  companyId: string,
  metadata: ClockInMetadata = {}
): Promise<ServiceResult<{ timeLog: SerializedTimeLog }>> {
  const tenantResult = await resolveTenantContext(userId, companyId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;

  const activeLog = await prisma.timeLog.findFirst({
    where: { userId: tenant.userId, companyId: tenant.companyId, clockOut: null },
  });

  if (activeLog) {
    return fail(
      TimeTrackingErrorCodes.USER_ALREADY_CLOCKED_IN,
      'User already has an active clock-in session.'
    );
  }

  const now = utcNow();
  const timeLog = await prisma.timeLog.create({
    data: {
      userId: tenant.userId,
      companyId: tenant.companyId,
      clockIn: now,
      clockInIp: metadata.clockInIp ?? null,
      latitude: toDecimal(metadata.latitude),
      longitude: toDecimal(metadata.longitude),
      notes: metadata.notes ?? '',
    },
  });

  return { success: true, data: { timeLog: serializeTimeLog(timeLog) } };
}

export async function clockOutService(
  userId: string,
  companyId: string,
  metadata: ClockOutMetadata = {}
): Promise<ServiceResult<{ timeLog: SerializedTimeLog }>> {
  const tenantResult = await resolveTenantContext(userId, companyId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;

  const activeLog = await prisma.timeLog.findFirst({
    where: { userId: tenant.userId, companyId: tenant.companyId, clockOut: null },
  });

  if (!activeLog) {
    return fail(
      TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND,
      'No active clock-in session found for this user.'
    );
  }

  const now = utcNow();

  const timeLog = await prisma.$transaction(async (tx) => {
    await tx.activityLog.updateMany({
      where: { timeLogId: activeLog.id, endTime: null },
      data: { endTime: now },
    });

    const activityLogs = await tx.activityLog.findMany({
      where: { timeLogId: activeLog.id },
      select: { startTime: true, endTime: true },
    });

    const netWorkMinutes = computeNetWorkMinutes(activeLog.clockIn, now, activityLogs);

    return tx.timeLog.update({
      where: { id: activeLog.id },
      data: {
        clockOut: now,
        clockOutIp: metadata.clockOutIp ?? null,
        netWorkMinutes,
      },
    });
  });

  return { success: true, data: { timeLog: serializeTimeLog(timeLog) } };
}

export async function manageBreakService(
  userId: string,
  companyId: string,
  timeLogId: string,
  action: 'START' | 'END',
  statusId?: string,
  statusName?: string
): Promise<ServiceResult<{ activityLog: SerializedActivityLog }>> {
  const tenantResult = await resolveTenantContext(userId, companyId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;
  const scopeResult = await assertTimeLogTenantScope(timeLogId, tenant);
  if (!scopeResult.success) return scopeResult;

  const timeLog = scopeResult.data;

  if (timeLog.clockOut !== null) {
    return fail(
      TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND,
      'Cannot manage activities on a closed time log.'
    );
  }

  const now = utcNow();

  if (action === 'START') {
    const statusResult = await resolveActivityStatus(tenant.companyId, statusId, statusName);
    if (!statusResult.success) return statusResult;

    const status = statusResult.data;

    const openActivity = await prisma.activityLog.findFirst({
      where: { timeLogId, endTime: null },
    });

    if (openActivity) {
      return fail(
        TimeTrackingErrorCodes.BREAK_ALREADY_ACTIVE,
        'An active activity is already running for this time log.'
      );
    }

    const activityLog = await prisma.activityLog.create({
      data: {
        timeLogId,
        statusId: status.id,
        startTime: now,
      },
      include: activityLogInclude,
    });

    return { success: true, data: { activityLog: serializeActivityLog(activityLog) } };
  }

  const openActivity = await prisma.activityLog.findFirst({
    where: { timeLogId, endTime: null },
  });

  if (!openActivity) {
    return fail(
      TimeTrackingErrorCodes.NO_ACTIVE_BREAK_FOUND,
      'No active activity found to close.'
    );
  }

  const activityLog = await prisma.activityLog.update({
    where: { id: openActivity.id },
    data: { endTime: now },
    include: activityLogInclude,
  });

  return { success: true, data: { activityLog: serializeActivityLog(activityLog) } };
}

export async function setStatusService(
  userId: string,
  companyId: string,
  statusId?: string,
  statusName?: string
): Promise<ServiceResult<{ activityLog: SerializedActivityLog | null }>> {
  const tenantResult = await resolveTenantContext(userId, companyId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;

  const activeLog = await prisma.timeLog.findFirst({
    where: { userId: tenant.userId, companyId: tenant.companyId, clockOut: null },
    include: {
      activityLogs: {
        where: { endTime: null },
        take: 1,
        include: activityLogInclude,
      },
    },
  });

  if (!activeLog) {
    return fail(
      TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND,
      'No active clock-in session found for this user.'
    );
  }

  const openActivity = activeLog.activityLogs[0] ?? null;
  const now = utcNow();

  if (!statusId && !statusName) {
    if (!openActivity) {
      return { success: true, data: { activityLog: null } };
    }

    await prisma.activityLog.update({
      where: { id: openActivity.id },
      data: { endTime: now },
    });

    return { success: true, data: { activityLog: null } };
  }

  const statusResult = await resolveActivityStatus(tenant.companyId, statusId, statusName);
  if (!statusResult.success) return statusResult;

  const status = statusResult.data;

  if (openActivity?.statusId === status.id) {
    return {
      success: true,
      data: { activityLog: serializeActivityLog(openActivity) },
    };
  }

  if (openActivity) {
    await prisma.activityLog.update({
      where: { id: openActivity.id },
      data: { endTime: now },
    });
  }

  const activityLog = await prisma.activityLog.create({
    data: {
      timeLogId: activeLog.id,
      statusId: status.id,
      startTime: now,
    },
    include: activityLogInclude,
  });

  return { success: true, data: { activityLog: serializeActivityLog(activityLog) } };
}

function computeDaySummary(
  logs: {
    clockIn: Date;
    clockOut: Date | null;
    activityLogs: {
      startTime: Date;
      endTime: Date | null;
      status: { isProductive: boolean };
    }[];
  }[]
): MyDaySummary {
  let grossMs = 0;
  let breakMs = 0;

  for (const log of logs) {
    const clockIn = log.clockIn.getTime();
    const clockOut = log.clockOut ? log.clockOut.getTime() : Date.now();
    grossMs += Math.max(0, clockOut - clockIn);

    for (const entry of log.activityLogs) {
      const start = entry.startTime.getTime();
      const end = entry.endTime ? entry.endTime.getTime() : Date.now();
      const durationMs = Math.max(0, end - start);
      if (!entry.status.isProductive) {
        breakMs += durationMs;
      }
    }
  }

  const netMs = Math.max(0, grossMs - breakMs);

  return {
    gross: formatDurationHuman(grossMs),
    breaks: formatDurationHuman(breakMs),
    net: formatDurationHours(netMs),
  };
}

function buildMyDayTimeline(
  logs: {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    activityLogs: {
      id: string;
      startTime: Date;
      endTime: Date | null;
      status: { name: string; isProductive: boolean };
    }[];
  }[]
): MyDayTimelineEvent[] {
  const events: MyDayTimelineEvent[] = [];

  for (const log of [...logs].reverse()) {
    const clockInIso = isoField(log.clockIn);
    events.push({
      id: `${log.id}-start`,
      time: clockInIso,
      timeFormatted: formatTimeLocal(clockInIso),
      label: 'Shift started',
      duration: '—',
      isProductive: null,
      kind: 'shift_start',
    });

    for (const entry of log.activityLogs) {
      const startTime = isoField(entry.startTime);
      const endTime = isoFieldOrNull(entry.endTime);
      events.push({
        id: entry.id,
        time: startTime,
        timeFormatted: formatTimeLocal(startTime),
        label: entry.status.name,
        duration: activityDuration(startTime, endTime),
        isProductive: entry.status.isProductive,
        kind: 'status',
      });
    }

    if (log.clockOut) {
      const clockOutIso = isoField(log.clockOut);
      events.push({
        id: `${log.id}-end`,
        time: clockOutIso,
        timeFormatted: formatTimeLocal(clockOutIso),
        label: 'Shift ended',
        duration: '—',
        isProductive: null,
        kind: 'shift_end',
      });
    }
  }

  return events.sort(
    (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()
  );
}

export async function getActiveSessionService(
  userId: string,
  companyId: string
): Promise<ServiceResult<{ session: ActiveSession | null }>> {
  const tenantResult = await resolveTenantContext(userId, companyId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;

  const timeLog = await prisma.timeLog.findFirst({
    where: { userId: tenant.userId, companyId: tenant.companyId, clockOut: null },
    include: {
      activityLogs: {
        where: { endTime: null },
        take: 1,
        include: activityLogInclude,
      },
    },
  });

  if (!timeLog) {
    return { success: true, data: { session: null } };
  }

  const { activityLogs, ...timeLogData } = timeLog;
  const activeActivity = activityLogs[0] ?? null;

  return {
    success: true,
    data: {
      session: {
        timeLog: serializeTimeLog(timeLogData),
        activeActivity: activeActivity ? serializeActivityLog(activeActivity) : null,
      },
    },
  };
}

export async function getMyDayService(
  userId: string,
  companyId: string,
  date?: string
): Promise<ServiceResult<MyDayData>> {
  const tenantResult = await resolveTenantContext(userId, companyId);
  if (!tenantResult.success) return tenantResult;

  const tenant = tenantResult.data;
  const resolvedDate = date ?? utcNow().toISOString().slice(0, 10);
  const { rangeStart, rangeEnd } = resolveDateRange(resolvedDate);

  const [user, activityStatuses, logs, activeTimeLog] = await Promise.all([
    prisma.user.findFirst({
      where: { id: tenant.userId, companyId: tenant.companyId },
      select: { name: true },
    }),
    prisma.activityStatus.findMany({
      where: { companyId: tenant.companyId },
      select: { id: true, name: true, isProductive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.timeLog.findMany({
      where: {
        userId: tenant.userId,
        companyId: tenant.companyId,
        clockIn: { gte: rangeStart, lte: rangeEnd },
      },
      include: {
        activityLogs: {
          include: activityLogInclude,
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { clockIn: 'desc' },
    }),
    prisma.timeLog.findFirst({
      where: { userId: tenant.userId, companyId: tenant.companyId, clockOut: null },
      include: {
        activityLogs: {
          where: { endTime: null },
          take: 1,
          include: activityLogInclude,
        },
      },
    }),
  ]);

  if (!user) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Employee not found in this company.');
  }

  let activeSession: ActiveSession | null = null;
  if (activeTimeLog) {
    const { activityLogs, ...timeLogData } = activeTimeLog;
    const activeActivity = activityLogs[0] ?? null;
    activeSession = {
      timeLog: serializeTimeLog(timeLogData),
      activeActivity: activeActivity ? serializeActivityLog(activeActivity) : null,
    };
  }

  const shifts: MyDayShiftRow[] = logs.map((log) => {
    const serialized = serializeTimeLog(log);
    const activities = log.activityLogs.map((entry) => serializeActivityLog(entry));
    const clockInIso = isoField(serialized.clockIn);
    const clockOutIso = isoFieldOrNull(serialized.clockOut);
    const metrics = computeSessionMetrics(
      clockInIso,
      clockOutIso,
      activities as { startTime: string; endTime: string | null }[]
    );

    const netWorkHours =
      log.netWorkMinutes != null
        ? formatNetWorkMinutes(log.netWorkMinutes)
        : log.clockOut
          ? formatDurationHours(metrics.netMs)
          : '—';

    return {
      timeLogId: log.id,
      clockIn: clockInIso,
      clockOut: clockOutIso,
      clockInFormatted: formatTimeLocal(clockInIso),
      clockOutFormatted: clockOutIso ? formatTimeLocal(clockOutIso) : 'Active',
      status: log.clockOut ? 'closed' : 'active',
      breakDeductions: formatDurationHuman(metrics.breakMs),
      netWorkHours,
      notes: String(serialized.notes),
    };
  });

  const activities: MyDayActivityRow[] = logs.flatMap((log) => {
    const shiftClockInFormatted = formatTimeLocal(isoField(serializeTimeLog(log).clockIn));
    return log.activityLogs.map((entry) => {
      const serialized = serializeActivityLog(entry);
      const startTime = isoField(serialized.startTime);
      const endTime = isoFieldOrNull(serialized.endTime);
      return {
        id: entry.id,
        timeLogId: log.id,
        shiftClockInFormatted,
        statusName: String(serialized.statusName),
        startTime,
        endTime,
        startFormatted: formatTimeLocal(startTime),
        endFormatted: endTime ? formatTimeLocal(endTime) : 'Active',
        duration: activityDuration(startTime, endTime),
      };
    });
  });

  return {
    success: true,
    data: {
      employeeName: user.name,
      date: resolvedDate,
      activeSession,
      activityStatuses,
      shifts,
      activities,
      timeline: buildMyDayTimeline(logs),
      summary: computeDaySummary(logs),
    },
  };
}
