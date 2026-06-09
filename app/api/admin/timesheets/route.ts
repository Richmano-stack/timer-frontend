import { fail } from '@/lib/http/api-handler';
import { executeAdminRoute } from '@/lib/http/session-route';
import { getTimesheetsService } from '@/lib/services/admin-dashboard.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { timesheetsQuerySchema } from '@/lib/validators/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = timesheetsQuerySchema.safeParse({
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  });

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { startDate, endDate } = parsed.data;

  return executeAdminRoute(request, ({ organizationId }) =>
    getTimesheetsService(organizationId, startDate, endDate)
  );
}
