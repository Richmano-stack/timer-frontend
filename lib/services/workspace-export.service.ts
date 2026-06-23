import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  assertOrganizationId,
  withOrganizationScope,
} from '@/lib/security/organization-context';
import { ServiceResult } from '@/lib/types/api-response';
import { toCsvValue } from '@/lib/utils/admin-metrics';
import { buildZipBuffer } from '@/lib/utils/zip-export';

/** Maximum time-log rows included in a single export archive. */
export const EXPORT_TIME_LOG_ROW_LIMIT = 50_000;

/** Maximum audit-log rows included in a single export archive. */
export const EXPORT_AUDIT_LOG_ROW_LIMIT = 10_000;

/** Default lookback window when no date range query params are supplied. */
export const DEFAULT_EXPORT_DAYS = 90;

export interface WorkspaceExportOptions {
  startDate?: string;
  endDate?: string;
}

export interface WorkspaceExportPayload {
  buffer: Buffer;
  filename: string;
}

export interface ExportMemberRow {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface ExportAuditLogRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorUserId: string;
  actorEmail: string;
  metadata: unknown | null;
  createdAt: string;
}

function defaultExportDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - DEFAULT_EXPORT_DAYS);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function resolveExportDateRange(options?: WorkspaceExportOptions): {
  startDate: string;
  endDate: string;
  rangeStart: Date;
  rangeEnd: Date;
} {
  const defaults = defaultExportDateRange();
  const startDate = options?.startDate ?? defaults.startDate;
  const endDate = options?.endDate ?? defaults.endDate;
  const rangeStart = new Date(`${startDate}T00:00:00.000Z`);
  const rangeEnd = new Date(`${endDate}T23:59:59.999Z`);

  return { startDate, endDate, rangeStart, rangeEnd };
}

function formatExportTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

function buildExportFilename(orgSlug: string, exportedAt: Date): string {
  return `${orgSlug}_export_${formatExportTimestamp(exportedAt)}.zip`;
}

function buildTimeLogsCsv(
  rows: {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    activityStatus: string;
    startTime: string;
    endTime: string | null;
    notes: string | null;
  }[]
): string {
  const header = [
    'Time Log ID',
    'User ID',
    'Employee Name',
    'Employee Email',
    'Activity Status',
    'Start Time (UTC)',
    'End Time (UTC)',
    'Notes',
  ];

  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        toCsvValue(row.id),
        toCsvValue(row.userId),
        toCsvValue(row.userName),
        toCsvValue(row.userEmail),
        toCsvValue(row.activityStatus),
        toCsvValue(row.startTime),
        toCsvValue(row.endTime ?? ''),
        toCsvValue(row.notes ?? ''),
      ].join(',')
    ),
  ];

  return lines.join('\n');
}

export async function buildWorkspaceExport(
  organizationId: string,
  options?: WorkspaceExportOptions
): Promise<ServiceResult<WorkspaceExportPayload>> {
  assertOrganizationId(organizationId, 'buildWorkspaceExport');

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true },
  });

  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  const { startDate, endDate, rangeStart, rangeEnd } = resolveExportDateRange(options);

  if (rangeStart > rangeEnd) {
    return fail(TimeTrackingErrorCodes.VALIDATION_ERROR, 'startDate must be before endDate.');
  }

  const [members, timeLogs, auditLogs] = await Promise.all([
    prisma.member.findMany({
      where: withOrganizationScope(organizationId, {}),
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.timeLog.findMany({
      where: withOrganizationScope(organizationId, {
        startTime: { gte: rangeStart, lte: rangeEnd },
      }),
      orderBy: { startTime: 'desc' },
      take: EXPORT_TIME_LOG_ROW_LIMIT,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        notes: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        activityStatus: {
          select: { name: true },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: EXPORT_AUDIT_LOG_ROW_LIMIT,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        actorUserId: true,
        metadata: true,
        createdAt: true,
        actor: {
          select: { email: true },
        },
      },
    }),
  ]);

  const memberRows: ExportMemberRow[] = members.map((member) => ({
    memberId: member.id,
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    role: member.role,
    joinedAt: member.createdAt.toISOString(),
  }));

  const auditRows: ExportAuditLogRow[] = auditLogs.map((log) => ({
    id: log.id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    actorUserId: log.actorUserId,
    actorEmail: log.actor.email,
    metadata: log.metadata ?? null,
    createdAt: log.createdAt.toISOString(),
  }));

  const timeLogCsv = buildTimeLogsCsv(
    timeLogs.map((log) => ({
      id: log.id,
      userId: log.user.id,
      userName: log.user.name,
      userEmail: log.user.email,
      activityStatus: log.activityStatus.name,
      startTime: log.startTime.toISOString(),
      endTime: log.endTime?.toISOString() ?? null,
      notes: log.notes,
    }))
  );

  const exportedAt = new Date();
  const manifest = {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    exportedAt: exportedAt.toISOString(),
    timeLogDateRange: { startDate, endDate },
    limits: {
      timeLogs: EXPORT_TIME_LOG_ROW_LIMIT,
      auditLogs: EXPORT_AUDIT_LOG_ROW_LIMIT,
    },
    counts: {
      members: memberRows.length,
      timeLogs: timeLogs.length,
      auditLogs: auditRows.length,
    },
  };

  const buffer = buildZipBuffer([
    { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
    { name: 'members.json', content: JSON.stringify(memberRows, null, 2) },
    { name: 'time_logs.csv', content: timeLogCsv },
    { name: 'audit_logs.json', content: JSON.stringify(auditRows, null, 2) },
  ]);

  return {
    success: true,
    data: {
      buffer,
      filename: buildExportFilename(organization.slug, exportedAt),
    },
  };
}
