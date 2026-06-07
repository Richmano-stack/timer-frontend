import { fail, fromServiceResult } from '@/lib/http/api-handler';
import { getAdminOverviewService } from '@/lib/services/admin-dashboard.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { companyIdQuerySchema } from '@/lib/validators/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = companyIdQuerySchema.safeParse({
    companyId: searchParams.get('companyId'),
  });

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const result = await getAdminOverviewService(parsed.data.companyId);
  return fromServiceResult(result);
}
