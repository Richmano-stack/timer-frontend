import { fail, fromServiceResult } from '@/lib/http/api-handler';
import { getTimesheetsService } from '@/lib/services/admin-dashboard.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { timesheetsQuerySchema } from '@/lib/validators/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = timesheetsQuerySchema.safeParse({
    companyId: searchParams.get('companyId'),
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  });

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { companyId, startDate, endDate } = parsed.data;
  const result = await getTimesheetsService(companyId, startDate, endDate);
  return fromServiceResult(result);
}
