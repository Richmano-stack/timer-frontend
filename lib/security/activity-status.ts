import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';
import { isProductiveType } from '@/lib/utils/status-type';
import { StatusType } from '@prisma/client';

export interface ResolvedActivityStatus {
  id: string;
  name: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
  isProductive: boolean;
}

export async function resolveActivityStatus(
  organizationId: string,
  statusId?: string,
  statusName?: string
): Promise<ServiceResult<ResolvedActivityStatus>> {
  if (statusId) {
    const status = await prisma.activityStatus.findFirst({
      where: { id: statusId, organizationId },
    });

    if (!status) {
      return fail(
        TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
        'Activity status not found for this organization.'
      );
    }

    return {
      success: true,
      data: {
        ...status,
        isProductive: isProductiveType(status.type),
      },
    };
  }

  if (statusName) {
    const status = await prisma.activityStatus.findFirst({
      where: { organizationId, name: statusName },
    });

    if (!status) {
      return fail(
        TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
        'Activity status not found for this organization.'
      );
    }

    return {
      success: true,
      data: {
        ...status,
        isProductive: isProductiveType(status.type),
      },
    };
  }

  return fail(
    TimeTrackingErrorCodes.VALIDATION_ERROR,
    'statusId or statusName is required when starting an activity.'
  );
}

export async function resolveAvailableStatus(
  organizationId: string
): Promise<ServiceResult<ResolvedActivityStatus>> {
  return resolveActivityStatus(organizationId, undefined, 'Available');
}
