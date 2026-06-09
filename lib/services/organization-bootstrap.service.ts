import { DEFAULT_ACTIVITY_STATUSES } from '@/lib/constants/default-activity-statuses';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';

export async function seedDefaultActivityStatuses(
  organizationId: string
): Promise<ServiceResult<{ seeded: number }>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  let seeded = 0;

  for (const status of DEFAULT_ACTIVITY_STATUSES) {
    await prisma.activityStatus.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: status.name,
        },
      },
      update: {
        type: status.type,
        colorCode: status.colorCode,
        isBillable: status.isBillable,
      },
      create: {
        organizationId,
        name: status.name,
        type: status.type,
        colorCode: status.colorCode,
        isBillable: status.isBillable,
      },
    });
    seeded += 1;
  }

  return { success: true, data: { seeded } };
}
