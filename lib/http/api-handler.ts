import { NextResponse } from 'next/server';
import { AuthErrorCodes } from '@/lib/errors/auth';
import { InvitationErrorCodes } from '@/lib/errors/invitation';
import { JoinErrorCodes } from '@/lib/errors/join';
import {
  TimeTrackingErrorCode,
  TimeTrackingErrorCodes,
} from '@/lib/errors/time-tracking';
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
  USER_NOT_IN_COMPANY: 403,
  VALIDATION_ERROR: 400,
  INTERNAL_SERVER_ERROR: 500,
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status?: number) {
  const resolvedStatus =
    status ?? ERROR_STATUS_MAP[code as TimeTrackingErrorCode] ?? 400;

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
  handler: () => Promise<ServiceResult<T>>
) {
  try {
    const result = await handler();
    return fromServiceResult(result);
  } catch (error) {
    console.error('[API] Unhandled service error:', error);
    return fail(
      TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred. Please try again later.',
      500
    );
  }
}
