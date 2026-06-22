import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';

export interface OrganizationContext {
  userId: string;
  organizationId: string;
}

/**
 * Merge `organizationId` into a Prisma `where` clause for multi-tenant models
 * (TimeLog, Member, Invitation, etc.). Services must receive `organizationId`
 * from {@link resolveOrganizationContext} or a server-verified record — never
 * from unvalidated client input alone.
 */
export function withOrganizationScope<T extends Record<string, unknown>>(
  organizationId: string,
  where: T
): T & { organizationId: string } {
  return { ...where, organizationId };
}

/**
 * Runtime guard for service entry points that require tenant scope.
 * Prefer failing early before any Prisma call when `organizationId` is missing.
 */
export function assertOrganizationId(
  organizationId: string | null | undefined,
  label = 'query'
): asserts organizationId is string {
  if (!organizationId) {
    throw new Error(`Tenant scope violation: missing organizationId for ${label}`);
  }
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
