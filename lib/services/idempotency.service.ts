import { createHash } from 'node:crypto';
import { IdempotencyStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import { ServiceResult } from '@/lib/types/api-response';

export const IdempotencyOperations = {
  CLOCK_IN: 'clock-in',
  CLOCK_OUT: 'clock-out',
  STATUS: 'status',
} as const;

export type IdempotencyOperation =
  (typeof IdempotencyOperations)[keyof typeof IdempotencyOperations];

export interface IdempotencyScope {
  organizationId: string;
  userId: string;
  operation: IdempotencyOperation;
  key: string;
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const IN_FLIGHT_POLL_MS = 50;
const IN_FLIGHT_MAX_WAIT_MS = 30_000;

const uniqueWhere = (scope: IdempotencyScope) => ({
  organizationId_userId_operation_key: {
    organizationId: scope.organizationId,
    userId: scope.userId,
    operation: scope.operation,
    key: scope.key,
  },
});

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hashIdempotencyPayload(payload: unknown): string {
  const normalized = JSON.stringify(payload ?? {});
  return createHash('sha256').update(normalized).digest('hex');
}

function expiresAtFromNow(): Date {
  return new Date(Date.now() + IDEMPOTENCY_TTL_MS);
}

function parseStoredResult<T>(snapshot: Prisma.JsonValue | null): ServiceResult<T> | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  const record = snapshot as { success?: boolean };
  if (record.success === true && 'data' in snapshot) {
    return snapshot as ServiceResult<T>;
  }
  if (record.success === false && 'error' in snapshot) {
    return snapshot as ServiceResult<T>;
  }

  return null;
}

async function deleteExpiredRecord(scope: IdempotencyScope): Promise<void> {
  await prisma.idempotencyKey.deleteMany({
    where: {
      organizationId: scope.organizationId,
      userId: scope.userId,
      operation: scope.operation,
      key: scope.key,
      expiresAt: { lt: new Date() },
    },
  });
}

async function findRecord(scope: IdempotencyScope) {
  return prisma.idempotencyKey.findUnique({
    where: uniqueWhere(scope),
  });
}

async function waitForCompletedResult<T>(scope: IdempotencyScope): Promise<ServiceResult<T>> {
  const deadline = Date.now() + IN_FLIGHT_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const record = await findRecord(scope);

    if (!record || record.expiresAt < new Date()) {
      return fail(
        TimeTrackingErrorCodes.IDEMPOTENCY_IN_PROGRESS,
        'A request with this idempotency key is still processing. Retry shortly.'
      );
    }

    if (record.status === IdempotencyStatus.COMPLETED) {
      const cached = parseStoredResult<T>(record.responseSnapshot);
      if (cached) {
        return cached;
      }
      break;
    }

    await sleep(IN_FLIGHT_POLL_MS);
  }

  return fail(
    TimeTrackingErrorCodes.IDEMPOTENCY_IN_PROGRESS,
    'A request with this idempotency key is still processing. Retry shortly.'
  );
}

function conflictResult<T>(): ServiceResult<T> {
  return fail(
    TimeTrackingErrorCodes.IDEMPOTENCY_KEY_CONFLICT,
    'This idempotency key was already used with a different request payload.'
  );
}

async function handleExistingRecord<T>(
  scope: IdempotencyScope,
  requestHash: string
): Promise<ServiceResult<T> | null> {
  const existing = await findRecord(scope);
  if (!existing) {
    return null;
  }

  if (existing.expiresAt < new Date()) {
    await prisma.idempotencyKey.delete({ where: uniqueWhere(scope) });
    return null;
  }

  if (existing.requestHash !== requestHash) {
    return conflictResult();
  }

  if (existing.status === IdempotencyStatus.COMPLETED) {
    const cached = parseStoredResult<T>(existing.responseSnapshot);
    if (cached) {
      return cached;
    }
  }

  return waitForCompletedResult(scope);
}

/**
 * Executes a mutation once per (organizationId, userId, operation, key).
 * Parallel retries with the same payload wait for the in-flight request and
 * receive the same cached ServiceResult.
 */
export async function withIdempotency<T>(
  scope: IdempotencyScope,
  requestHash: string,
  execute: () => Promise<ServiceResult<T>>
): Promise<ServiceResult<T>> {
  await deleteExpiredRecord(scope);

  const existingResult = await handleExistingRecord<T>(scope, requestHash);
  if (existingResult) {
    return existingResult;
  }

  try {
    await prisma.idempotencyKey.create({
      data: {
        organizationId: scope.organizationId,
        userId: scope.userId,
        operation: scope.operation,
        key: scope.key,
        requestHash,
        status: IdempotencyStatus.PENDING,
        expiresAt: expiresAtFromNow(),
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    const raced = await handleExistingRecord<T>(scope, requestHash);
    if (raced) {
      return raced;
    }

    return waitForCompletedResult(scope);
  }

  try {
    const result = await execute();

    await prisma.idempotencyKey.update({
      where: uniqueWhere(scope),
      data: {
        status: IdempotencyStatus.COMPLETED,
        responseSnapshot: result as Prisma.InputJsonValue,
      },
    });

    return result;
  } catch (error) {
    await prisma.idempotencyKey
      .delete({ where: uniqueWhere(scope) })
      .catch(() => undefined);
    throw error;
  }
}
