import { fail, executeServiceRoute } from '@/lib/http/api-handler';
import { clockInService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { clockInBodySchema } from '@/lib/validators/time-tracking';

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

  const parsed = clockInBodySchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { userId, companyId, clockInIp, latitude, longitude, notes } = parsed.data;

  return executeServiceRoute(() =>
    clockInService(userId, companyId, {
      clockInIp,
      latitude,
      longitude,
      notes,
    })
  );
}
