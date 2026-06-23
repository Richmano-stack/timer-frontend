import { executeIdempotentMutation } from '@/lib/http/idempotency';
import { executeAuthenticatedRoute } from '@/lib/http/session-route';
import { IdempotencyOperations } from '@/lib/services/idempotency.service';
import { clockOutService } from '@/lib/services/time-tracking.service';

export async function POST(request: Request) {
  return executeAuthenticatedRoute(request, ({ userId, organizationId }) =>
    executeIdempotentMutation({
      request,
      userId,
      organizationId,
      operation: IdempotencyOperations.CLOCK_OUT,
      payload: {},
      execute: () => clockOutService(userId, organizationId),
    })
  );
}
