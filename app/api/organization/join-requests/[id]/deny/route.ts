import { executeAdminRoute } from '@/lib/http/session-route';
import { denyJoinRequest } from '@/lib/services/join-request.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  return executeAdminRoute(request, ({ organizationId, userId }) =>
    denyJoinRequest(id, organizationId, userId)
  );
}
