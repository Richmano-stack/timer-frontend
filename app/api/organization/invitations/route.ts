import { JoinErrorCodes } from '@/lib/errors/join';
import { fail } from '@/lib/http/api-handler';
import {
  executeAdminRoute,
  invalidJsonResponse,
  parseJsonBody,
} from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { OrganizationRole } from '@/lib/organization/roles';
import {
  checkInviteCreationRateLimit,
  formatInviteCreationRateLimitMessage,
} from '@/lib/security/join-rate-limit';
import {
  createInvitationForAdmin,
  listPendingInvitationsForAdmin,
} from '@/lib/services/invitation.service';
import { createInvitationSchema } from '@/lib/validators/invitation';

export async function GET(request: Request) {
  return executeAdminRoute(request, ({ organizationId }) =>
    listPendingInvitationsForAdmin(organizationId)
  );
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request);

  if (body === null) {
    return invalidJsonResponse();
  }

  const parsed = createInvitationSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAdminRoute(request, async ({ organizationId, userId, memberRole }) => {
    const rateLimit = checkInviteCreationRateLimit(request, userId, organizationId);
    if (!rateLimit.allowed) {
      return {
        success: false as const,
        error: {
          code: JoinErrorCodes.RATE_LIMITED,
          message: formatInviteCreationRateLimitMessage(rateLimit),
        },
      };
    }

    return createInvitationForAdmin(
      organizationId,
      userId,
      memberRole,
      parsed.data.email,
      parsed.data.role as OrganizationRole
    );
  });
}
