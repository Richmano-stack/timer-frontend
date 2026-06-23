import { executeAdminRoute } from '@/lib/http/session-route';
import { listAuditLogsForAdmin } from '@/lib/services/audit-log.service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? undefined;

  return executeAdminRoute(request, ({ organizationId }) =>
    listAuditLogsForAdmin(organizationId, action ? { action } : undefined)
  );
}
