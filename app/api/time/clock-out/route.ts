import { fail, executeServiceRoute } from '@/lib/http/api-handler';
import { clockOutService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { clockOutBodySchema } from '@/lib/validators/time-tracking';

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

  const parsed = clockOutBodySchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { userId, companyId, clockOutIp } = parsed.data;

  return executeServiceRoute(() => clockOutService(userId, companyId, { clockOutIp }));
}
