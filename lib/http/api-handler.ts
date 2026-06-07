import { NextResponse } from 'next/server';
import {
  TimeTrackingErrorCode,
  TimeTrackingErrorCodes,
} from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';

const ERROR_STATUS_MAP: Record<TimeTrackingErrorCode, number> = {
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
