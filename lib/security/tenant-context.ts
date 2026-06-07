import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';

export interface TenantContext {
  userId: string;
  companyId: string;
}

/**
 * Verifies the caller's userId belongs to the claimed companyId before any
 * tenant-scoped read or write proceeds.
 */
export async function resolveTenantContext(
  userId: string,
  companyId: string
): Promise<ServiceResult<TenantContext>> {
  const user = await prisma.user.findFirst({
    where: { id: userId, companyId, isActive: true },
    select: { id: true, companyId: true },
  });

  if (!user) {
    return fail(
      TimeTrackingErrorCodes.USER_NOT_IN_COMPANY,
      'User does not belong to the specified company.'
    );
  }

  return { success: true, data: { userId: user.id, companyId: user.companyId } };
}

/**
 * Ensures a TimeLog resource is strictly bound to the verified tenant context.
 */
export async function assertTimeLogTenantScope(
  timeLogId: string,
  tenant: TenantContext
): Promise<
  ServiceResult<{
    id: string;
    userId: string;
    companyId: string;
    clockIn: Date;
    clockOut: Date | null;
  }>
> {
  const timeLog = await prisma.timeLog.findFirst({
    where: {
      id: timeLogId,
      userId: tenant.userId,
      companyId: tenant.companyId,
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      clockIn: true,
      clockOut: true,
    },
  });

  if (!timeLog) {
    return fail(
      TimeTrackingErrorCodes.TIMELOG_NOT_FOUND,
      'Time log not found within the verified company context.'
    );
  }

  return { success: true, data: timeLog };
}
