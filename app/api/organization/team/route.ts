import { executeAdminRoute } from '@/lib/http/session-route';
import { getTeamForAdmin } from '@/lib/services/organization-team.service';

export async function GET(request: Request) {
  return executeAdminRoute(request, ({ organizationId, memberRole }) =>
    getTeamForAdmin(organizationId, memberRole)
  );
}
