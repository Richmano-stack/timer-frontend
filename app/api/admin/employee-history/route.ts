import { fail, fromServiceResult } from '@/lib/http/api-handler';
import { getEmployeeHistoryService } from '@/lib/services/admin-dashboard.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { employeeHistoryQuerySchema } from '@/lib/validators/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = employeeHistoryQuerySchema.safeParse({
    companyId: searchParams.get('companyId'),
    userId: searchParams.get('userId'),
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { companyId, userId, limit } = parsed.data;
  const result = await getEmployeeHistoryService(companyId, userId, limit);
  return fromServiceResult(result);
}
