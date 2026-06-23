import { NextResponse } from 'next/server';
import { ActivityStatusErrorCodes } from '@/lib/errors/activity-status';
import { AuthErrorCodes } from '@/lib/errors/auth';
import { InvitationErrorCodes } from '@/lib/errors/invitation';
import { JoinErrorCodes } from '@/lib/errors/join';
import {
  TimeTrackingErrorCode,
  TimeTrackingErrorCodes,
} from '@/lib/errors/time-tracking';
import {
  ApiRequestOutcome,
  runWithApiRequestLogging,
  TenantLogFields,
} from '@/lib/http/request-log';
import { captureApiServiceError } from '@/lib/monitoring/sentry-tenant';
import { ServiceResult } from '@/lib/types/api-response';

const ERROR_STATUS_MAP: Record<string, number> = {
  [JoinErrorCodes.ORGANIZATION_NOT_FOUND]: 404,
  [JoinErrorCodes.DOMAIN_NOT_ALLOWED]: 403,
  [JoinErrorCodes.NO_ALLOWED_DOMAINS]: 403,
  [JoinErrorCodes.ALREADY_MEMBER]: 409,
  [JoinErrorCodes.INVITATION_NOT_FOUND]: 404,
  [JoinErrorCodes.INVITATION_EXPIRED]: 410,
  [JoinErrorCodes.INVITATION_NOT_PENDING]: 410,
  [JoinErrorCodes.INVITATION_EMAIL_MISMATCH]: 403,
  [JoinErrorCodes.JOIN_REQUEST_NOT_FOUND]: 404,
  [JoinErrorCodes.JOIN_REQUEST_NOT_PENDING]: 409,
  [JoinErrorCodes.JOIN_REQUEST_ALREADY_PENDING]: 409,
  [JoinErrorCodes.AUTH_REQUIRED]: 401,
  [InvitationErrorCodes.INVITATION_ALREADY_PENDING]: 409,
  [InvitationErrorCodes.INVITATION_NOT_REVOCABLE]: 409,
  [ActivityStatusErrorCodes.ACTIVITY_STATUS_NAME_CONFLICT]: 409,
  [ActivityStatusErrorCodes.ACTIVITY_STATUS_IN_USE]: 409,
  RATE_LIMITED: 429,
  [AuthErrorCodes.REGISTRATION_NOT_ALLOWED]: 403,
  [AuthErrorCodes.INVITATION_REQUIRED]: 400,
  [AuthErrorCodes.INVITATION_INVALID]: 403,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NO_ACTIVE_ORGANIZATION: 403,
  USER_ALREADY_CLOCKED_IN: 409,
  NO_ACTIVE_SESSION_FOUND: 404,
  BREAK_ALREADY_ACTIVE: 409,
  NO_ACTIVE_BREAK_FOUND: 404,
  TIMELOG_NOT_FOUND: 404,
  ACTIVITY_STATUS_NOT_FOUND: 404,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  USER_NOT_IN_COMPANY: 403,
  MEMBER_DEACTIVATED: 403,
  VALIDATION_ERROR: 400,
  INTERNAL_SERVER_ERROR: 500,
};

export function resolveErrorStatus(code: string, explicitStatus?: number): number {
  return explicitStatus ?? ERROR_STATUS_MAP[code as TimeTrackingErrorCode] ?? 400;
}

export function outcomeFromServiceResult<T>(result: ServiceResult<T>): ApiRequestOutcome {
  if (result.success) {
    return { status: 200, success: true };
  }

  return {
    status: resolveErrorStatus(result.error.code),
    success: false,
    errorCode: result.error.code,
  };
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status?: number) {
  const resolvedStatus = resolveErrorStatus(code, status);

  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: resolvedStatus }
  );
}

export function fromServiceResult<T>(result: ServiceResult<T>) {
  if (result.success) {
    return ok(result.data);
  }

  return fail(result.error.code, result.error.message);
}

/**
 * Executes a service handler inside a try/catch so Prisma/runtime faults never
 * leak raw stack traces to clients.
 */
export async function executeServiceRoute<T>(
  request: Request,
  handler: () => Promise<ServiceResult<T>>,
  tenant?: TenantLogFields
) {
  return runWithApiRequestLogging(request, async () => {
    try {
      const result = await handler();
      return {
        response: fromServiceResult(result),
        outcome: outcomeFromServiceResult(result),
        tenant,
      };
    } catch (error) {
      console.error('[API] Unhandled service error:', error);
      void captureApiServiceError(error, tenant);
      const response = fail(
        TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
        'An unexpected error occurred. Please try again later.',
        500
      );
      return {
        response,
        outcome: {
          status: 500,
          success: false,
          errorCode: TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
        },
        tenant,
      };
    }
  });
}

/**
 * Wraps a public route handler (no session) with structured request logging.
 * Tenant fields are omitted from the log payload.
 */
export async function executePublicRoute(
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  return runWithApiRequestLogging(request, async () => {
    const response = await handler();
    return {
      response,
      outcome: {
        status: response.status,
        success: response.ok,
      },
    };
  });
}
