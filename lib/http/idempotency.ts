import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  hashIdempotencyPayload,
  IdempotencyOperation,
  IdempotencyScope,
  withIdempotency,
} from '@/lib/services/idempotency.service';
import { ServiceResult } from '@/lib/types/api-response';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const MAX_KEY_LENGTH = 128;
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function parseIdempotencyKeyHeader(request: Request): string | null {
  const raw = request.headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!raw) {
    return null;
  }
  return raw;
}

export function validateIdempotencyKey(key: string): ServiceResult<never> | null {
  if (!KEY_PATTERN.test(key) || key.length > MAX_KEY_LENGTH) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      'Idempotency-Key must be 1–128 characters (letters, digits, underscore, hyphen).'
    );
  }

  return null;
}

export async function executeIdempotentMutation<T>({
  request,
  userId,
  organizationId,
  operation,
  payload,
  execute,
}: {
  request: Request;
  userId: string;
  organizationId: string;
  operation: IdempotencyOperation;
  payload: unknown;
  execute: () => Promise<ServiceResult<T>>;
}): Promise<ServiceResult<T>> {
  const key = parseIdempotencyKeyHeader(request);
  if (!key) {
    return execute();
  }

  const validationError = validateIdempotencyKey(key);
  if (validationError) {
    return validationError;
  }

  const scope: IdempotencyScope = {
    organizationId,
    userId,
    operation,
    key,
  };

  return withIdempotency(scope, hashIdempotencyPayload(payload), execute);
}
