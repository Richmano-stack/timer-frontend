import { prisma } from '@/lib/db/prisma';
import {
  AUTO_CLOCK_OUT_NOTE,
  DEFAULT_MAX_SHIFT_HOURS,
  resolveMaxShiftHours,
} from '@/lib/organization/compliance-limits';
import { withOrganizationScope } from '@/lib/security/organization-context';
import { utcNow } from '@/lib/utils/time';

export { AUTO_CLOCK_OUT_NOTE, DEFAULT_MAX_SHIFT_HOURS, resolveMaxShiftHours };

export interface AutoClockOutJobResult {
  organizationsProcessed: number;
  segmentsClosed: number;
  errors: string[];
}

function cutoffBefore(now: Date, maxShiftHours: number): Date {
  return new Date(now.getTime() - maxShiftHours * 60 * 60 * 1000);
}

async function closeStaleSegmentsForOrganization(
  organizationId: string,
  now: Date
): Promise<number> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { metadata: true },
  });

  const maxShiftHours = resolveMaxShiftHours(organization?.metadata ?? null);
  const cutoff = cutoffBefore(now, maxShiftHours);

  const staleSegments = await prisma.timeLog.findMany({
    where: withOrganizationScope(organizationId, {
      endTime: null,
      startTime: { lt: cutoff },
    }),
    select: { id: true, notes: true },
  });

  let closed = 0;

  for (const segment of staleSegments) {
    const notes = segment.notes
      ? `${segment.notes}\n${AUTO_CLOCK_OUT_NOTE}`
      : AUTO_CLOCK_OUT_NOTE;

    const result = await prisma.timeLog.updateMany({
      where: withOrganizationScope(organizationId, {
        id: segment.id,
        endTime: null,
      }),
      data: {
        endTime: now,
        notes,
      },
    });

    closed += result.count;
  }

  return closed;
}

export async function runAutoClockOutJob(): Promise<AutoClockOutJobResult> {
  const now = utcNow();
  const errors: string[] = [];
  let segmentsClosed = 0;

  const organizationsWithOpenSegments = await prisma.timeLog.findMany({
    where: { endTime: null },
    select: { organizationId: true },
    distinct: ['organizationId'],
  });

  for (const { organizationId } of organizationsWithOpenSegments) {
    try {
      segmentsClosed += await closeStaleSegmentsForOrganization(organizationId, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`organization ${organizationId}: ${message}`);
      console.error('[cron-auto-clockout] Failed for organization:', organizationId, error);
    }
  }

  return {
    organizationsProcessed: organizationsWithOpenSegments.length,
    segmentsClosed,
    errors,
  };
}
