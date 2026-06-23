import { fail } from '@/lib/http/api-handler';
import { executeAdminRoute, invalidJsonResponse, parseJsonBody } from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { updateMemberStatusForAdmin } from '@/lib/services/organization-team.service';
import { updateMemberStatusSchema } from '@/lib/validators/organization-member';

interface RouteContext {
  params: Promise<{ memberId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { memberId } = await context.params;
  const body = await parseJsonBody(request);

  if (body === null) {
    return invalidJsonResponse();
  }

  const parsed = updateMemberStatusSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAdminRoute(request, ({ organizationId, memberRole, userId }) =>
    updateMemberStatusForAdmin(
      organizationId,
      memberRole,
      userId,
      memberId,
      parsed.data.status
    )
  );
}
