import { executeAdminRoute } from '@/lib/http/session-route';
import { revokeInvitationForAdmin } from '@/lib/services/invitation.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;

  return executeAdminRoute(request, ({ organizationId, memberRole }) =>
    revokeInvitationForAdmin(organizationId, id, memberRole)
  );
}
