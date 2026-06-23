import {
  fail,
  fromServiceResult,
  outcomeFromServiceResult,
} from '@/lib/http/api-handler';
import { runWithApiRequestLogging } from '@/lib/http/request-log';
import { applySentryTenantTags } from '@/lib/monitoring/sentry-tenant';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  resolveAdminSessionContext,
  resolveSessionContext,
  type SessionContext,
} from '@/lib/security/session-context';
import { ServiceResult } from '@/lib/types/api-response';

export async function executeAuthenticatedRoute<T>(
  request: Request,
  handler: (ctx: { userId: string; organizationId: string }) => Promise<ServiceResult<T>>
) {
  return runWithApiRequestLogging(request, async () => {
    const contextResult = await resolveSessionContext(request);
    if (!contextResult.success) {
      return {
        response: fromServiceResult(contextResult),
        outcome: outcomeFromServiceResult(contextResult),
      };
    }

    const { userId, organizationId, memberRole } = contextResult.data;
    applySentryTenantTags({ organizationId });
    const result = await handler({ userId, organizationId });

    return {
      response: fromServiceResult(result),
      outcome: outcomeFromServiceResult(result),
      tenant: { userId, organizationId, memberRole },
    };
  });
}

export async function executeAdminRoute<T>(
  request: Request,
  handler: (ctx: SessionContext) => Promise<ServiceResult<T>>
) {
  return runWithApiRequestLogging(request, async () => {
    const contextResult = await resolveAdminSessionContext(request);
    if (!contextResult.success) {
      return {
        response: fromServiceResult(contextResult),
        outcome: outcomeFromServiceResult(contextResult),
      };
    }

    applySentryTenantTags({ organizationId: contextResult.data.organizationId });
    const result = await handler(contextResult.data);

    return {
      response: fromServiceResult(result),
      outcome: outcomeFromServiceResult(result),
      tenant: {
        userId: contextResult.data.userId,
        organizationId: contextResult.data.organizationId,
        memberRole: contextResult.data.memberRole,
      },
    };
  });
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
