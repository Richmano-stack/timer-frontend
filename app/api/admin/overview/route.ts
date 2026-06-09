import { executeAdminRoute } from '@/lib/http/session-route';
import { getAdminOverviewService } from '@/lib/services/admin-dashboard.service';

export async function GET(request: Request) {
  return executeAdminRoute(request, ({ organizationId }) =>
    getAdminOverviewService(organizationId)
  );
}
