import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { checkMemberActive } from '@/lib/services/organization-team.service';
import { ServiceResult } from '@/lib/types/api-response';

/**
 * Minimum interval between persisted heartbeat writes. Clients may POST every ~60s;
 * writes are skipped when lastSeenAt is newer than this threshold (rate-limit friendly).
 */
export const HEARTBEAT_WRITE_INTERVAL_MS = 30_000;

export interface MemberHeartbeatResult {
  lastSeenAt: string;
  updated: boolean;
}

export async function recordMemberHeartbeat(
  userId: string,
  organizationId: string
): Promise<ServiceResult<MemberHeartbeatResult>> {
  const activeCheck = await checkMemberActive(userId, organizationId);
  if (!activeCheck.success) {
    return activeCheck;
  }

  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { id: true, lastSeenAt: true },
  });

  if (!member) {
    return fail(
      TimeTrackingErrorCodes.USER_NOT_IN_COMPANY,
      'User is not a member of the specified organization.'
    );
  }

  const now = new Date();
  const shouldWrite =
    member.lastSeenAt === null ||
    now.getTime() - member.lastSeenAt.getTime() >= HEARTBEAT_WRITE_INTERVAL_MS;

  if (!shouldWrite) {
    return {
      success: true,
      data: {
        lastSeenAt: member.lastSeenAt.toISOString(),
        updated: false,
      },
    };
  }

  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { lastSeenAt: now },
    select: { lastSeenAt: true },
  });

  return {
    success: true,
    data: {
      lastSeenAt: updated.lastSeenAt!.toISOString(),
      updated: true,
    },
  };
}
