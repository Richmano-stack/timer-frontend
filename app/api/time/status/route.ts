import { fail } from '@/lib/http/api-handler';
import { executeIdempotentMutation } from '@/lib/http/idempotency';
import {
  executeAuthenticatedRoute,
  invalidJsonResponse,
  parseJsonBody,
} from '@/lib/http/session-route';
import { IdempotencyOperations } from '@/lib/services/idempotency.service';
import { setStatusService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { setStatusBodySchema } from '@/lib/validators/time-tracking';

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (body === null) return invalidJsonResponse();

  const parsed = setStatusBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { statusId, statusName } = parsed.data;

  return executeAuthenticatedRoute(request, ({ userId, organizationId }) =>
    executeIdempotentMutation({
      request,
      userId,
      organizationId,
      operation: IdempotencyOperations.STATUS,
      payload: parsed.data,
      execute: () => setStatusService(userId, organizationId, statusId, statusName),
    })
  );
}
