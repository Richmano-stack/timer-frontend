import { executeAdminRoute } from '@/lib/http/session-route';
import { listTimeLogAuditsForAdmin } from '@/lib/services/timesheet-correction.service';

interface RouteContext {
  params: Promise<{ timeLogId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { timeLogId } = await context.params;

  return executeAdminRoute(request, ({ organizationId }) =>
    listTimeLogAuditsForAdmin(organizationId, timeLogId)
  );
}
