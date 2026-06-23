import { api, ApiError } from '@/lib/api';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';

export type TimeActionType = 'clock-in' | 'clock-out' | 'status';

export interface QueuedTimeAction {
  id: string;
  type: TimeActionType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
}

const STORAGE_KEY = 'omnishift:offline-time-actions';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readTimeActionQueue(): QueuedTimeAction[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedTimeAction);
  } catch {
    return [];
  }
}

export function writeTimeActionQueue(actions: QueuedTimeAction[]): void {
  if (!canUseStorage()) return;

  if (actions.length === 0) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

function isQueuedTimeAction(value: unknown): value is QueuedTimeAction {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (record.type === 'clock-in' ||
      record.type === 'clock-out' ||
      record.type === 'status') &&
    typeof record.payload === 'object' &&
    record.payload !== null &&
    typeof record.idempotencyKey === 'string' &&
    typeof record.createdAt === 'string'
  );
}

export function enqueueTimeAction(
  input: Pick<QueuedTimeAction, 'type' | 'payload' | 'idempotencyKey'>
): QueuedTimeAction {
  const action: QueuedTimeAction = {
    id: crypto.randomUUID(),
    type: input.type,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    createdAt: new Date().toISOString(),
  };

  const queue = readTimeActionQueue();
  queue.push(action);
  writeTimeActionQueue(queue);
  return action;
}

export function removeTimeAction(id: string): void {
  const queue = readTimeActionQueue().filter((action) => action.id !== id);
  writeTimeActionQueue(queue);
}

function isIdempotentFlushSuccess(error: ApiError, type: TimeActionType): boolean {
  if (type === 'clock-in' && error.code === TimeTrackingErrorCodes.USER_ALREADY_CLOCKED_IN) {
    return true;
  }
  if (type === 'clock-out' && error.code === TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND) {
    return true;
  }
  return false;
}

export async function executeQueuedTimeAction(action: QueuedTimeAction): Promise<void> {
  const headers = { 'Idempotency-Key': action.idempotencyKey };

  try {
    switch (action.type) {
      case 'clock-in':
        await api.post('/api/time/clock-in', action.payload, { headers });
        return;
      case 'clock-out':
        await api.post('/api/time/clock-out', undefined, { headers });
        return;
      case 'status':
        await api.post('/api/time/status', action.payload, { headers });
        return;
    }
  } catch (error) {
    if (error instanceof ApiError && isIdempotentFlushSuccess(error, action.type)) {
      return;
    }
    throw error;
  }
}

export async function flushTimeActionQueue(): Promise<{
  flushed: number;
  error: Error | null;
}> {
  const queue = readTimeActionQueue();
  let flushed = 0;

  for (const action of queue) {
    try {
      await executeQueuedTimeAction(action);
      removeTimeAction(action.id);
      flushed += 1;
    } catch (error) {
      return {
        flushed,
        error: error instanceof Error ? error : new Error('Failed to sync offline actions'),
      };
    }
  }

  return { flushed, error: null };
}
