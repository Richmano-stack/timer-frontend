import { fail, fromServiceResult } from '@/lib/http/api-handler';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  resolveAdminSessionContext,
  resolveSessionContext,
} from '@/lib/security/session-context';
import { ServiceResult } from '@/lib/types/api-response';

export async function executeAuthenticatedRoute<T>(
  request: Request,
  handler: (ctx: { userId: string; organizationId: string }) => Promise<ServiceResult<T>>
) {
  const contextResult = await resolveSessionContext(request);
  if (!contextResult.success) {
    return fromServiceResult(contextResult);
  }

  const result = await handler(contextResult.data);
  return fromServiceResult(result);
}

export async function executeAdminRoute<T>(
  request: Request,
  handler: (ctx: { userId: string; organizationId: string }) => Promise<ServiceResult<T>>
) {
  const contextResult = await resolveAdminSessionContext(request);
  if (!contextResult.success) {
    return fromServiceResult(contextResult);
  }

  const result = await handler(contextResult.data);
  return fromServiceResult(result);
}

export async function parseJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function invalidJsonResponse() {
  return fail(TimeTrackingErrorCodes.VALIDATION_ERROR, 'Request body must be valid JSON.');
}
