import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';

export async function resolveActivityStatus(
  companyId: string,
  statusId?: string,
  statusName?: string
): Promise<
  ServiceResult<{
    id: string;
    name: string;
    isProductive: boolean;
  }>
> {
  if (statusId) {
    const status = await prisma.activityStatus.findFirst({
      where: { id: statusId, companyId },
      select: { id: true, name: true, isProductive: true },
    });

    if (!status) {
      return fail(
        TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
        'Activity status not found for this company.'
      );
    }

    return { success: true, data: status };
  }

  if (statusName) {
    const status = await prisma.activityStatus.findFirst({
      where: { companyId, name: statusName },
      select: { id: true, name: true, isProductive: true },
    });

    if (!status) {
      return fail(
        TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
        'Activity status not found for this company.'
      );
    }

    return { success: true, data: status };
  }

  return fail(
    TimeTrackingErrorCodes.VALIDATION_ERROR,
    'statusId or statusName is required when starting an activity.'
  );
}
