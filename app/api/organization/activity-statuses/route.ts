import { fail } from '@/lib/http/api-handler';
import {
  executeAdminRoute,
  invalidJsonResponse,
  parseJsonBody,
} from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  createActivityStatusForAdmin,
  listActivityStatusesForAdmin,
} from '@/lib/services/activity-status.service';
import { createActivityStatusSchema } from '@/lib/validators/activity-status';

export async function GET(request: Request) {
  return executeAdminRoute(request, ({ organizationId }) =>
    listActivityStatusesForAdmin(organizationId)
  );
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request);

  if (body === null) {
    return invalidJsonResponse();
  }

  const parsed = createActivityStatusSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAdminRoute(request, ({ organizationId }) =>
    createActivityStatusForAdmin(organizationId, parsed.data)
  );
}
