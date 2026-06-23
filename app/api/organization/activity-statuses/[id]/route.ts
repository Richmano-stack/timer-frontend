import { fail } from '@/lib/http/api-handler';
import {
  executeAdminRoute,
  invalidJsonResponse,
  parseJsonBody,
} from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  deleteActivityStatusForAdmin,
  updateActivityStatusForAdmin,
} from '@/lib/services/activity-status.service';
import { updateActivityStatusSchema } from '@/lib/validators/activity-status';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await parseJsonBody(request);

  if (body === null) {
    return invalidJsonResponse();
  }

  const parsed = updateActivityStatusSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAdminRoute(request, ({ organizationId }) =>
    updateActivityStatusForAdmin(organizationId, id, parsed.data)
  );
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;

  return executeAdminRoute(request, ({ organizationId }) =>
    deleteActivityStatusForAdmin(organizationId, id)
  );
}
