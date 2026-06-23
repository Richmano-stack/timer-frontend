import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  assertOrganizationId,
  withOrganizationScope,
} from '@/lib/security/organization-context';
import { ServiceResult } from '@/lib/types/api-response';
import type { PatchTimesheetInput } from '@/lib/validators/timesheet-correction';

export interface TimeLogCorrectionSnapshot {
  startTime: string;
  endTime: string | null;
  notes: string | null;
}

export interface PatchTimesheetResult {
  timeLogId: string;
  clockIn: string;
  clockOut: string | null;
  notes: string | null;
  auditId: string;
}

export interface TimeLogAuditEntry {
  id: string;
  reason: string;
  before: TimeLogCorrectionSnapshot;
  after: TimeLogCorrectionSnapshot;
  createdAt: string;
  actorLabel: string;
}

export interface ListTimeLogAuditsResult {
  audits: TimeLogAuditEntry[];
}

function isoField(value: Date): string {
  return value.toISOString();
}

function toSnapshot(segment: {
  startTime: Date;
  endTime: Date | null;
  notes: string | null;
}): TimeLogCorrectionSnapshot {
  return {
    startTime: isoField(segment.startTime),
    endTime: segment.endTime ? isoField(segment.endTime) : null,
    notes: segment.notes,
  };
}

function snapshotsEqual(
  before: TimeLogCorrectionSnapshot,
  after: TimeLogCorrectionSnapshot
): boolean {
  return (
    before.startTime === after.startTime &&
    before.endTime === after.endTime &&
    before.notes === after.notes
  );
}

export async function patchTimesheetForAdmin(
  organizationId: string,
  actorUserId: string,
  timeLogId: string,
  input: PatchTimesheetInput
): Promise<ServiceResult<PatchTimesheetResult>> {
  assertOrganizationId(organizationId, 'patchTimesheetForAdmin');

  const existing = await prisma.timeLog.findFirst({
    where: withOrganizationScope(organizationId, { id: timeLogId }),
    select: {
      id: true,
      startTime: true,
      endTime: true,
      notes: true,
    },
  });

  if (!existing) {
    return fail(TimeTrackingErrorCodes.TIMELOG_NOT_FOUND, 'Time log not found.');
  }

  const before = toSnapshot(existing);

  const nextStartTime =
    input.clockIn !== undefined ? new Date(input.clockIn) : existing.startTime;
  const nextEndTime =
    input.clockOut !== undefined
      ? input.clockOut === null
        ? null
        : new Date(input.clockOut)
      : existing.endTime;
  const nextNotes = input.notes !== undefined ? input.notes : existing.notes;

  if (nextEndTime !== null && nextStartTime.getTime() >= nextEndTime.getTime()) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      'clockIn must be before clockOut.'
    );
  }

  const after: TimeLogCorrectionSnapshot = {
    startTime: isoField(nextStartTime),
    endTime: nextEndTime ? isoField(nextEndTime) : null,
    notes: nextNotes,
  };

  if (snapshotsEqual(before, after)) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      'At least one field must change.'
    );
  }

  const updateData: Prisma.TimeLogUpdateInput = {};
  if (input.clockIn !== undefined) {
    updateData.startTime = nextStartTime;
  }
  if (input.clockOut !== undefined) {
    updateData.endTime = nextEndTime;
  }
  if (input.notes !== undefined) {
    updateData.notes = nextNotes;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.timeLog.update({
      where: { id: timeLogId },
      data: updateData,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        notes: true,
      },
    });

    const audit = await tx.timeLogAudit.create({
      data: {
        organizationId,
        timeLogId,
        actorUserId,
        reason: input.reason,
        before: before as Prisma.InputJsonValue,
        after: toSnapshot(updated) as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return { updated, auditId: audit.id };
  });

  return {
    success: true,
    data: {
      timeLogId: result.updated.id,
      clockIn: isoField(result.updated.startTime),
      clockOut: result.updated.endTime ? isoField(result.updated.endTime) : null,
      notes: result.updated.notes,
      auditId: result.auditId,
    },
  };
}

function parseSnapshot(value: unknown): TimeLogCorrectionSnapshot {
  if (!value || typeof value !== 'object') {
    return { startTime: '', endTime: null, notes: null };
  }
  const record = value as Record<string, unknown>;
  return {
    startTime: typeof record.startTime === 'string' ? record.startTime : '',
    endTime: record.endTime === null ? null : typeof record.endTime === 'string' ? record.endTime : null,
    notes: record.notes === null ? null : typeof record.notes === 'string' ? record.notes : null,
  };
}

function actorLabel(name: string | null | undefined, email: string): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;
  return email;
}

export async function listTimeLogAuditsForAdmin(
  organizationId: string,
  timeLogId: string
): Promise<ServiceResult<ListTimeLogAuditsResult>> {
  assertOrganizationId(organizationId, 'listTimeLogAuditsForAdmin');

  const timeLog = await prisma.timeLog.findFirst({
    where: withOrganizationScope(organizationId, { id: timeLogId }),
    select: { id: true },
  });

  if (!timeLog) {
    return fail(TimeTrackingErrorCodes.TIMELOG_NOT_FOUND, 'Time log not found.');
  }

  const audits = await prisma.timeLogAudit.findMany({
    where: withOrganizationScope(organizationId, { timeLogId }),
    orderBy: { createdAt: 'desc' },
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

  return {
    success: true,
    data: {
      audits: audits.map((audit) => ({
        id: audit.id,
        reason: audit.reason,
        before: parseSnapshot(audit.before),
        after: parseSnapshot(audit.after),
        createdAt: isoField(audit.createdAt),
        actorLabel: actorLabel(audit.actor.name, audit.actor.email),
      })),
    },
  };
}
