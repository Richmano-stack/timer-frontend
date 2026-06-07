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
