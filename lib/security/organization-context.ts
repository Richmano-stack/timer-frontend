import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';

export interface OrganizationContext {
  userId: string;
  organizationId: string;
}

export async function resolveOrganizationContext(
  userId: string,
  organizationId: string
): Promise<ServiceResult<OrganizationContext>> {
  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { userId: true, organizationId: true },
  });

  if (!member) {
    return fail(
      TimeTrackingErrorCodes.USER_NOT_IN_COMPANY,
      'User is not a member of the specified organization.'
    );
  }

  return {
    success: true,
    data: { userId: member.userId, organizationId: member.organizationId },
  };
}
