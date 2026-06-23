'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  enqueueTimeAction,
  flushTimeActionQueue,
  readTimeActionQueue,
  type QueuedTimeAction,
  type TimeActionType,
} from '@/lib/offline/time-action-queue';

export interface EnqueueTimeActionInput {
  type: TimeActionType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export function useOfflineMutationQueue({
  isOnline,
  onFlushComplete,
  onFlushError,
}: {
  isOnline: boolean;
  onFlushComplete?: () => void;
  onFlushError?: (message: string, code?: string) => void;
}) {
  const [pendingCount, setPendingCount] = useState(() => readTimeActionQueue().length);
  const [isFlushing, setIsFlushing] = useState(false);
  const flushingRef = useRef(false);
  const onFlushCompleteRef = useRef(onFlushComplete);
  const onFlushErrorRef = useRef(onFlushError);

  useEffect(() => {
    onFlushCompleteRef.current = onFlushComplete;
    onFlushErrorRef.current = onFlushError;
  }, [onFlushComplete, onFlushError]);

  const syncPendingCount = useCallback(() => {
    setPendingCount(readTimeActionQueue().length);
  }, []);

  const enqueue = useCallback(
    (input: EnqueueTimeActionInput): QueuedTimeAction => {
      const action = enqueueTimeAction(input);
      syncPendingCount();
      return action;
    },
    [syncPendingCount]
  );

  const flush = useCallback(async () => {
    if (!isOnline || flushingRef.current) return;

    const queue = readTimeActionQueue();
    if (queue.length === 0) return;

    flushingRef.current = true;
    setIsFlushing(true);

    try {
      const { flushed, error } = await flushTimeActionQueue();
      syncPendingCount();

      if (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : error.message || 'Failed to sync offline actions';
        const code = error instanceof ApiError ? error.code : undefined;
        onFlushErrorRef.current?.(message, code);
      } else if (flushed > 0) {
        onFlushCompleteRef.current?.();
      }
    } finally {
      flushingRef.current = false;
      setIsFlushing(false);
    }
  }, [isOnline, syncPendingCount]);

  useEffect(() => {
    if (isOnline) {
      void flush();
    }
  }, [isOnline, flush]);

  return {
    pendingCount,
    isFlushing,
    enqueue,
    flush,
  };
}
