import { fail } from '@/lib/http/api-handler';
import {
  executeAdminRoute,
  executeAuthenticatedRoute,
} from '@/lib/http/session-route';
import { getMyDayService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { myDayQuerySchema } from '@/lib/validators/time-tracking';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = myDayQuerySchema.safeParse({
      date: searchParams.get('date') ?? undefined,
      userId: searchParams.get('userId') ?? undefined,
    });

    if (!parsed.success) {
      return fail(
        TimeTrackingErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const { date, userId: targetUserId } = parsed.data;

    if (targetUserId) {
      return executeAdminRoute(request, ({ organizationId }) =>
        getMyDayService(targetUserId, organizationId, date)
      );
    }

    return executeAuthenticatedRoute(request, ({ userId, organizationId }) =>
      getMyDayService(userId, organizationId, date)
    );
  } catch (error) {
    console.error('[API] Unhandled route error:', error);
    return fail(
      TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred. Please try again later.',
      500
    );
  }
}
