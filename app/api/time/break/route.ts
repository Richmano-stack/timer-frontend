import { fail, executeServiceRoute } from '@/lib/http/api-handler';
import { manageBreakService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { breakBodySchema } from '@/lib/validators/time-tracking';

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      'Request body must be valid JSON.'
    );
  }

  const parsed = breakBodySchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { userId, companyId, timeLogId, action, statusId, statusName } = parsed.data;

  return executeServiceRoute(() =>
    manageBreakService(userId, companyId, timeLogId, action, statusId, statusName)
  );
}
