import { executeAuthenticatedRoute } from '@/lib/http/session-route';
import { clockOutService } from '@/lib/services/time-tracking.service';

export async function POST(request: Request) {
  return executeAuthenticatedRoute(request, ({ userId, organizationId }) =>
    clockOutService(userId, organizationId)
  );
}
