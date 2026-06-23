import { prisma } from '@/lib/db/prisma';
import { ActivityStatusErrorCodes } from '@/lib/errors/activity-status';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';
import { isProductiveType } from '@/lib/utils/status-type';
import { StatusType } from '@prisma/client';
import type {
  CreateActivityStatusInput,
  UpdateActivityStatusInput,
} from '@/lib/validators/activity-status';

export interface ActivityStatusDto {
  id: string;
  name: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
  isProductive: boolean;
}

function toActivityStatusDto(status: {
  id: string;
  name: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
}): ActivityStatusDto {
  return {
    id: status.id,
    name: status.name,
    type: status.type,
    colorCode: status.colorCode,
    isBillable: status.isBillable,
    isProductive: isProductiveType(status.type),
  };
}

async function hasOpenTimeLogsForStatus(
  organizationId: string,
  activityStatusId: string
): Promise<boolean> {
  const openCount = await prisma.timeLog.count({
    where: {
      organizationId,
      activityStatusId,
      endTime: null,
    },
  });

  return openCount > 0;
}

export async function listActivityStatusesForAdmin(
  organizationId: string
): Promise<ServiceResult<ActivityStatusDto[]>> {
  const statuses = await prisma.activityStatus.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      colorCode: true,
      isBillable: true,
    },
  });

  return {
    success: true,
    data: statuses.map(toActivityStatusDto),
  };
}

export async function createActivityStatusForAdmin(
  organizationId: string,
  input: CreateActivityStatusInput
): Promise<ServiceResult<ActivityStatusDto>> {
  const name = input.name.trim();

  const existing = await prisma.activityStatus.findFirst({
    where: { organizationId, name },
    select: { id: true },
  });

  if (existing) {
    return fail(
      ActivityStatusErrorCodes.ACTIVITY_STATUS_NAME_CONFLICT,
      'An activity status with this name already exists.'
    );
  }

  const status = await prisma.activityStatus.create({
    data: {
      organizationId,
      name,
      type: input.type,
      colorCode: input.colorCode,
      isBillable: input.isBillable,
    },
    select: {
      id: true,
      name: true,
      type: true,
      colorCode: true,
      isBillable: true,
    },
  });

  return {
    success: true,
    data: toActivityStatusDto(status),
  };
}

export async function updateActivityStatusForAdmin(
  organizationId: string,
  activityStatusId: string,
  input: UpdateActivityStatusInput
): Promise<ServiceResult<ActivityStatusDto>> {
  const existing = await prisma.activityStatus.findFirst({
    where: { id: activityStatusId, organizationId },
    select: { id: true, name: true },
  });

  if (!existing) {
    return fail(
      TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
      'Activity status not found for this organization.'
    );
  }

  if (await hasOpenTimeLogsForStatus(organizationId, activityStatusId)) {
    return fail(
      ActivityStatusErrorCodes.ACTIVITY_STATUS_IN_USE,
      'This activity status is in use on an open shift and cannot be modified.'
    );
  }

  const nextName = input.name?.trim();

  if (nextName && nextName !== existing.name) {
    const nameConflict = await prisma.activityStatus.findFirst({
      where: {
        organizationId,
        name: nextName,
        id: { not: activityStatusId },
      },
      select: { id: true },
    });

    if (nameConflict) {
      return fail(
        ActivityStatusErrorCodes.ACTIVITY_STATUS_NAME_CONFLICT,
        'An activity status with this name already exists.'
      );
    }
  }

  const status = await prisma.activityStatus.update({
    where: { id: activityStatusId },
    data: {
      ...(nextName !== undefined ? { name: nextName } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.colorCode !== undefined ? { colorCode: input.colorCode } : {}),
      ...(input.isBillable !== undefined ? { isBillable: input.isBillable } : {}),
    },
    select: {
      id: true,
      name: true,
      type: true,
      colorCode: true,
      isBillable: true,
    },
  });

  return {
    success: true,
    data: toActivityStatusDto(status),
  };
}

export async function deleteActivityStatusForAdmin(
  organizationId: string,
  activityStatusId: string
): Promise<ServiceResult<ActivityStatusDto>> {
  const existing = await prisma.activityStatus.findFirst({
    where: { id: activityStatusId, organizationId },
    select: {
      id: true,
      name: true,
      type: true,
      colorCode: true,
      isBillable: true,
    },
  });

  if (!existing) {
    return fail(
      TimeTrackingErrorCodes.ACTIVITY_STATUS_NOT_FOUND,
      'Activity status not found for this organization.'
    );
  }

  if (await hasOpenTimeLogsForStatus(organizationId, activityStatusId)) {
    return fail(
      ActivityStatusErrorCodes.ACTIVITY_STATUS_IN_USE,
      'This activity status is in use on an open shift and cannot be deleted.'
    );
  }

  await prisma.activityStatus.delete({
    where: { id: activityStatusId },
  });

  return {
    success: true,
    data: toActivityStatusDto(existing),
  };
}
