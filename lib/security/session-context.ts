import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { isAdminRole } from '@/lib/organization/roles';
import { ServiceResult } from '@/lib/types/api-response';

export { isAdminRole };

export interface SessionContext {
  userId: string;
  organizationId: string;
  memberRole: string;
}

export async function resolveSessionContext(
  request: Request
): Promise<ServiceResult<SessionContext>> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return fail(TimeTrackingErrorCodes.UNAUTHORIZED, 'Authentication required.');
  }

  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) {
    return fail(
      TimeTrackingErrorCodes.NO_ACTIVE_ORGANIZATION,
      'No active organization selected.',
    );
  }

  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });

  if (!member) {
    return fail(
      TimeTrackingErrorCodes.USER_NOT_IN_COMPANY,
      'User is not a member of the active organization.',
    );
  }

  return {
    success: true,
    data: {
      userId: session.user.id,
      organizationId,
      memberRole: member.role,
    },
  };
}

export async function resolveAdminSessionContext(
  request: Request
): Promise<ServiceResult<SessionContext>> {
  const contextResult = await resolveSessionContext(request);
  if (!contextResult.success) return contextResult;

  if (!isAdminRole(contextResult.data.memberRole)) {
    return fail(TimeTrackingErrorCodes.FORBIDDEN, 'Admin access required.');
  }

  return contextResult;
}
