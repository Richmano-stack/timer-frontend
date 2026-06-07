import { fail, executeServiceRoute } from '@/lib/http/api-handler';
import { getMyDayService } from '@/lib/services/time-tracking.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { myDayQuerySchema } from '@/lib/validators/time-tracking';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = myDayQuerySchema.safeParse({
      userId: searchParams.get('userId'),
      companyId: searchParams.get('companyId'),
      date: searchParams.get('date') ?? undefined,
    });

    if (!parsed.success) {
      return fail(
        TimeTrackingErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const { userId, companyId, date } = parsed.data;

    return executeServiceRoute(() => getMyDayService(userId, companyId, date));
  } catch (error) {
    console.error('[API] Unhandled route error:', error);
    return fail(
      TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred. Please try again later.',
      500
    );
  }
}
