import { executeAuthenticatedRoute } from '@/lib/http/session-route';
import { recordMemberHeartbeat } from '@/lib/services/member-heartbeat.service';

export async function POST(request: Request) {
  return executeAuthenticatedRoute(request, ({ userId, organizationId }) =>
    recordMemberHeartbeat(userId, organizationId)
  );
}
