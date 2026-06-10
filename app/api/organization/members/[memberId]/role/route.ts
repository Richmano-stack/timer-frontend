import { fail } from '@/lib/http/api-handler';
import { executeAdminRoute, invalidJsonResponse, parseJsonBody } from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { OrganizationRole } from '@/lib/organization/roles';
import { updateMemberRoleForAdmin } from '@/lib/services/organization-team.service';
import { updateMemberRoleSchema } from '@/lib/validators/organization';

interface RouteContext {
  params: Promise<{ memberId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { memberId } = await context.params;
  const body = await parseJsonBody(request);

  if (body === null) {
    return invalidJsonResponse();
  }

  const parsed = updateMemberRoleSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAdminRoute(request, ({ organizationId, memberRole }) =>
    updateMemberRoleForAdmin(
      organizationId,
      memberRole,
      memberId,
      parsed.data.role as OrganizationRole
    )
  );
}
