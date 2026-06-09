import { executeAdminRoute } from '@/lib/http/session-route';
import { seedDefaultActivityStatuses } from '@/lib/services/organization-bootstrap.service';

export async function POST(request: Request) {
  return executeAdminRoute(request, ({ organizationId }) =>
    seedDefaultActivityStatuses(organizationId)
  );
}
