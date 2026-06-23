import { fail } from '@/lib/http/api-handler';
import {
  executeAdminRoute,
  invalidJsonResponse,
  parseJsonBody,
} from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { patchTimesheetForAdmin } from '@/lib/services/timesheet-correction.service';
import { patchTimesheetSchema } from '@/lib/validators/timesheet-correction';

interface RouteContext {
  params: Promise<{ timeLogId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { timeLogId } = await context.params;
  const body = await parseJsonBody(request);

  if (body === null) {
    return invalidJsonResponse();
  }

  const parsed = patchTimesheetSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAdminRoute(request, ({ organizationId, userId }) =>
    patchTimesheetForAdmin(organizationId, userId, timeLogId, parsed.data)
  );
}
