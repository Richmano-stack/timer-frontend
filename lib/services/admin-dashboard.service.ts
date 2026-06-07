import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';
import {
  formatDurationHuman,
  formatDurationHours,
  formatNetWorkMinutes,
  formatTimeLocal,
} from '@/lib/utils/admin-metrics';
import { serializeTimeLog, utcNow } from '@/lib/utils/time';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function isoField(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

function isoFieldOrNull(value: unknown): string | null {
  if (value == null) return null;
  return isoField(value);
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

export interface ActiveWorkerRow {
  userId: string;
  employeeName: string;
  timeLogId: string;
  clockIn: string;
  status: 'working' | 'on_break';
  statusLabel: string;
  activityStatusName: string | null;
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
  activeWorkers: ActiveWorkerRow[];
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
}

export interface EmployeeHistoryRow {
  timeLogId: string;
  clockIn: string;
  clockOut: string | null;
  breakDeductions: string;
  netWorkHours: string;
  notes: string;
}

function computeNonProductiveMs(
  activityLogs: {
    startTime: Date;
    endTime: Date | null;
    status: { isProductive: boolean };
  }[],
  nowMs: number
): number {
  let total = 0;

  for (const entry of activityLogs) {
    if (entry.status.isProductive) continue;
    const start = entry.startTime.getTime();
    const end = entry.endTime ? entry.endTime.getTime() : nowMs;
    total += Math.max(0, end - start);
  }

  return total;
}

function toLegacyActiveWorker(log: {
  id: string;
  user: { id: string; name: string };
  clockIn: Date;
  activityLogs: { status: { name: string; isProductive: boolean } }[];
}): ActiveWorkerRow {
  const openActivity = log.activityLogs[0] ?? null;
  const activityStatusName = openActivity?.status.name ?? null;
  const isNonProductiveBreak = openActivity ? !openActivity.status.isProductive : false;

  return {
    userId: log.user.id,
    employeeName: log.user.name,
    timeLogId: log.id,
    clockIn: isoField(log.clockIn),
    status: isNonProductiveBreak ? 'on_break' : 'working',
    statusLabel: activityStatusName ?? 'Available',
    activityStatusName,
  };
}

export async function getAdminOverviewService(
  companyId: string
): Promise<ServiceResult<AdminOverviewData>> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Company not found.');
  }

  const now = utcNow();
  const nowMs = now.getTime();

  const [totalRegistered, activeUsers, activeLogs] = await Promise.all([
    prisma.user.count({ where: { companyId, isActive: true } }),
    prisma.user.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.timeLog.findMany({
      where: { companyId, clockOut: null },
      include: {
        user: { select: { id: true, name: true } },
        activityLogs: {
          include: { status: { select: { name: true, isProductive: true } } },
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: { clockIn: 'asc' },
    }),
  ]);

  const activeLogByUserId = new Map(activeLogs.map((log) => [log.userId, log]));

  const floorAgents: FloorAgentRow[] = activeUsers.map((user) => {
    const log = activeLogByUserId.get(user.id);

    if (!log) {
      return {
        userId: user.id,
        employeeName: user.name,
        timeLogId: null,
        clockIn: null,
        displayStatus: 'Clocked Out',
        isProductive: null,
        statusSince: null,
        breakToday: '—',
        isOnShift: false,
      };
    }

    const openActivity =
      [...log.activityLogs].reverse().find((entry) => entry.endTime === null) ?? null;
    const clockInIso = isoField(log.clockIn);
    const breakTodayMs = computeNonProductiveMs(log.activityLogs, nowMs);

    if (!openActivity) {
      return {
        userId: user.id,
        employeeName: user.name,
        timeLogId: log.id,
        clockIn: clockInIso,
        displayStatus: 'Available',
        isProductive: true,
        statusSince: clockInIso,
        breakToday: formatDurationHuman(breakTodayMs),
        isOnShift: true,
      };
    }

    return {
      userId: user.id,
      employeeName: user.name,
      timeLogId: log.id,
      clockIn: clockInIso,
      displayStatus: openActivity.status.name,
      isProductive: openActivity.status.isProductive,
      statusSince: isoField(openActivity.startTime),
      breakToday: formatDurationHuman(breakTodayMs),
      isOnShift: true,
    };
  });

  let availableCount = 0;
  let onBreakCount = 0;
  const statusCountMap = new Map<string, StatusBreakdownItem>();

  for (const agent of floorAgents) {
    if (!agent.isOnShift) continue;

    if (agent.displayStatus === 'Available') {
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
    { name: 'Available', count: availableCount, isProductive: true },
    ...[...statusCountMap.values()]
      .filter((item) => item.name !== 'Available')
      .sort((left, right) => left.name.localeCompare(right.name)),
    { name: 'Off Floor', count: offFloorCount, isProductive: false },
  ];

  const complianceAlerts: ComplianceAlert[] = [];

  for (const log of activeLogs) {
    const clockInIso = isoField(log.clockIn);
    const elapsedMs = nowMs - log.clockIn.getTime();

    if (elapsedMs > TWELVE_HOURS_MS) {
      complianceAlerts.push({
        userId: log.user.id,
        employeeName: log.user.name,
        timeLogId: log.id,
        clockIn: clockInIso,
        elapsedHours: Math.round((elapsedMs / (1000 * 60 * 60)) * 10) / 10,
        message: 'Potential missed clock-out detected',
        severity: 'critical',
      });
    }

    const openActivity =
      [...log.activityLogs].reverse().find((entry) => entry.endTime === null) ?? null;

    if (openActivity && !openActivity.status.isProductive) {
      const statusElapsedMs = nowMs - openActivity.startTime.getTime();
      if (statusElapsedMs > THIRTY_MINUTES_MS) {
        complianceAlerts.push({
          userId: log.user.id,
          employeeName: log.user.name,
          timeLogId: log.id,
          clockIn: clockInIso,
          elapsedHours: Math.round((statusElapsedMs / (1000 * 60 * 60)) * 10) / 10,
          message: `Extended ${openActivity.status.name.toLowerCase()} (${formatDurationHuman(statusElapsedMs)})`,
          severity: 'warning',
        });
      }
    }
  }

  const activeWorkers: ActiveWorkerRow[] = activeLogs.map((log) => {
    const openOnly = [...log.activityLogs].reverse().find((entry) => entry.endTime === null);
    return toLegacyActiveWorker({
      ...log,
      activityLogs: openOnly ? [openOnly] : [],
    });
  });

  return {
    success: true,
    data: {
      kpis: {
        activeShiftCount: activeLogs.length,
        onBreakCount,
        availableCount,
        offFloorCount,
        totalRegistered,
      },
      statusBreakdown,
      floorAgents,
      complianceAlerts,
      activeWorkers,
    },
  };
}

export async function getTimesheetsService(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<ServiceResult<{ rows: TimesheetRow[] }>> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Company not found.');
  }

  const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
  const rangeEnd = new Date(`${endDate}T23:59:59.999Z`);

  if (rangeStart > rangeEnd) {
    return fail(TimeTrackingErrorCodes.VALIDATION_ERROR, 'startDate must be before endDate.');
  }

  const logs = await prisma.timeLog.findMany({
    where: {
      companyId,
      clockIn: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      user: { select: { id: true, name: true } },
      activityLogs: { include: { status: { select: { isProductive: true } } } },
    },
    orderBy: { clockIn: 'desc' },
  });

  const rows: TimesheetRow[] = logs.map((log) => {
    const serialized = serializeTimeLog(log);
    const clockInIso = isoField(serialized.clockIn);
    const clockOutIso = isoFieldOrNull(serialized.clockOut);
    const clockOutMs = clockOutIso ? new Date(clockOutIso).getTime() : Date.now();
    const grossMs = Math.max(0, clockOutMs - new Date(clockInIso).getTime());
    const nonProductiveMs = computeNonProductiveMs(log.activityLogs, nowMsFromLog(log));

    const netWorkHours =
      log.netWorkMinutes != null
        ? formatNetWorkMinutes(log.netWorkMinutes)
        : formatDurationHours(Math.max(0, grossMs - nonProductiveMs));

    return {
      timeLogId: log.id,
      userId: log.user.id,
      employeeName: log.user.name,
      date: isoField(serialized.clockIn),
      clockIn: isoField(serialized.clockIn),
      clockOut: isoFieldOrNull(serialized.clockOut),
      clockInFormatted: formatTimeLocal(isoField(serialized.clockIn)),
      clockOutFormatted: serialized.clockOut
        ? formatTimeLocal(isoField(serialized.clockOut))
        : '—',
      breakDeductions: formatDurationHuman(nonProductiveMs),
      netWorkHours,
    };
  });

  return { success: true, data: { rows } };
}

function nowMsFromLog(log: { clockOut: Date | null }): number {
  return log.clockOut ? log.clockOut.getTime() : Date.now();
}

export async function getEmployeeHistoryService(
  companyId: string,
  userId: string,
  limit: number
): Promise<ServiceResult<{ employeeName: string; sessions: EmployeeHistoryRow[] }>> {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
  });

  if (!user) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Employee not found in this company.');
  }

  const logs = await prisma.timeLog.findMany({
    where: { companyId, userId },
    include: { activityLogs: { include: { status: { select: { isProductive: true } } } } },
    orderBy: { clockIn: 'desc' },
    take: limit,
  });

  const sessions: EmployeeHistoryRow[] = logs.map((log) => {
    const serialized = serializeTimeLog(log);
    const clockInIso = isoField(serialized.clockIn);
    const clockOutIso = isoFieldOrNull(serialized.clockOut);
    const clockOutMs = clockOutIso ? new Date(clockOutIso).getTime() : Date.now();
    const grossMs = Math.max(0, clockOutMs - new Date(clockInIso).getTime());
    const nonProductiveMs = computeNonProductiveMs(log.activityLogs, nowMsFromLog(log));

    const netWorkHours =
      log.netWorkMinutes != null
        ? formatNetWorkMinutes(log.netWorkMinutes)
        : formatDurationHours(Math.max(0, grossMs - nonProductiveMs));

    return {
      timeLogId: log.id,
      clockIn: isoField(serialized.clockIn),
      clockOut: isoFieldOrNull(serialized.clockOut),
      breakDeductions: formatDurationHuman(nonProductiveMs),
      netWorkHours,
      notes: String(serialized.notes),
    };
  });

  return {
    success: true,
    data: { employeeName: user.name, sessions },
  };
}
