import { fail } from '@/lib/http/api-handler';
import { executeIdempotentMutation } from '@/lib/http/idempotency';
import {
  executeAuthenticatedRoute,
  invalidJsonResponse,
  parseJsonBody,
} from '@/lib/http/session-route';
import { IdempotencyOperations } from '@/lib/services/idempotency.service';
import { clockInService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { clockInBodySchema } from '@/lib/validators/time-tracking';

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (body === null) return invalidJsonResponse();

  const parsed = clockInBodySchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAuthenticatedRoute(request, ({ userId, organizationId }) =>
    executeIdempotentMutation({
      request,
      userId,
      organizationId,
      operation: IdempotencyOperations.CLOCK_IN,
      payload: parsed.data,
      execute: () => clockInService(userId, organizationId, parsed.data.notes),
    })
  );
}
