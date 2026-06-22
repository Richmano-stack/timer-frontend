import { fail } from '@/lib/http/api-handler';
import { executeAdminRoute } from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  listJoinRequestsForAdmin,
  type JoinRequestListStatus,
} from '@/lib/services/join-request.service';

const VALID_STATUSES = new Set<JoinRequestListStatus>(['PENDING', 'APPROVED', 'DENIED']);

export async function GET(request: Request) {
  const statusParam = new URL(request.url).searchParams.get('status');
  const status: JoinRequestListStatus =
    statusParam && VALID_STATUSES.has(statusParam as JoinRequestListStatus)
      ? (statusParam as JoinRequestListStatus)
      : 'PENDING';

  if (statusParam && !VALID_STATUSES.has(statusParam as JoinRequestListStatus)) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      'status must be one of PENDING, APPROVED, or DENIED.'
    );
  }

  return executeAdminRoute(request, ({ organizationId }) =>
    listJoinRequestsForAdmin(organizationId, status)
  );
}
