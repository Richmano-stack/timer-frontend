import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api';
import {
  enqueueTimeAction,
  executeQueuedTimeAction,
  flushTimeActionQueue,
  readTimeActionQueue,
  writeTimeActionQueue,
} from '@/lib/offline/time-action-queue';

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    statusCode: number;
    code?: string;

    constructor(message: string, statusCode: number, code?: string) {
      super(message);
      this.statusCode = statusCode;
      this.code = code;
      this.name = 'ApiError';
    }
  },
}));

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe('time-action-queue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubGlobal('window', { localStorage });
    vi.mocked(api.post).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists queued actions in localStorage', () => {
    const action = enqueueTimeAction({
      type: 'clock-in',
      payload: { notes: 'test' },
      idempotencyKey: 'key-1',
    });

    const queue = readTimeActionQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: action.id,
      type: 'clock-in',
      idempotencyKey: 'key-1',
    });
  });

  it('flushes queued actions in order with stored idempotency keys', async () => {
    enqueueTimeAction({
      type: 'clock-in',
      payload: {},
      idempotencyKey: 'clock-in-key',
    });
    enqueueTimeAction({
      type: 'status',
      payload: { statusId: 'status-1' },
      idempotencyKey: 'status-key',
    });

    vi.mocked(api.post).mockResolvedValue({ segment: {} });

    const result = await flushTimeActionQueue();

    expect(result.error).toBeNull();
    expect(result.flushed).toBe(2);
    expect(readTimeActionQueue()).toHaveLength(0);
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/api/time/clock-in',
      {},
      { headers: { 'Idempotency-Key': 'clock-in-key' } }
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/api/time/status',
      { statusId: 'status-1' },
      { headers: { 'Idempotency-Key': 'status-key' } }
    );
  });

  it('treats idempotent clock-in conflicts as successful flush', async () => {
    writeTimeActionQueue([
      {
        id: 'queued-1',
        type: 'clock-in',
        payload: {},
        idempotencyKey: 'clock-in-key',
        createdAt: new Date().toISOString(),
      },
    ]);

    vi.mocked(api.post).mockRejectedValue(
      new ApiError('User already has an active clock-in session.', 409, 'USER_ALREADY_CLOCKED_IN')
    );

    const result = await flushTimeActionQueue();

    expect(result.error).toBeNull();
    expect(result.flushed).toBe(1);
    expect(readTimeActionQueue()).toHaveLength(0);
  });

  it('stops flush on failure and keeps remaining queue items', async () => {
    writeTimeActionQueue([
      {
        id: 'queued-1',
        type: 'clock-out',
        payload: {},
        idempotencyKey: 'clock-out-key',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'queued-2',
        type: 'status',
        payload: {},
        idempotencyKey: 'status-key',
        createdAt: new Date().toISOString(),
      },
    ]);

    vi.mocked(api.post).mockRejectedValue(new Error('Network error'));

    const result = await flushTimeActionQueue();

    expect(result.flushed).toBe(0);
    expect(result.error?.message).toBe('Network error');
    expect(readTimeActionQueue()).toHaveLength(2);
  });

  it('executes clock-out with undefined body', async () => {
    await executeQueuedTimeAction({
      id: 'queued-1',
      type: 'clock-out',
      payload: {},
      idempotencyKey: 'clock-out-key',
      createdAt: new Date().toISOString(),
    });

    expect(api.post).toHaveBeenCalledWith('/api/time/clock-out', undefined, {
      headers: { 'Idempotency-Key': 'clock-out-key' },
    });
  });
});
