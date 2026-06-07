import { fail, executeServiceRoute } from '@/lib/http/api-handler';
import { getActiveSessionService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { activeSessionQuerySchema } from '@/lib/validators/time-tracking';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = activeSessionQuerySchema.safeParse({
      userId: searchParams.get('userId'),
      companyId: searchParams.get('companyId'),
    });

    if (!parsed.success) {
      return fail(
        TimeTrackingErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const { userId, companyId } = parsed.data;

    return executeServiceRoute(() => getActiveSessionService(userId, companyId));
  } catch (error) {
    console.error('[API] Unhandled route error:', error);
    return fail(
      TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred. Please try again later.',
      500
    );
  }
}
