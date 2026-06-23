'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useOfflineMutationQueue } from '@/hooks/useOfflineMutationQueue';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AVAILABLE_STATUS_NAME } from '@/lib/utils/status-type';
import {
  ActivityStatusOption,
  MyDayResponse,
  SetStatusResponse,
  TimeLogResponse,
  TimeLogSegment,
} from '@/types/time-tracking';
import { ActiveSession } from '@/types/time-tracking';

export function localTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ClockInOptions {
  notes?: string;
}

function findAvailableStatus(statuses: ActivityStatusOption[]): ActivityStatusOption | undefined {
  return statuses.find((status) => status.name === AVAILABLE_STATUS_NAME);
}

function buildOptimisticSegment(
  status: ActivityStatusOption,
  notes: string | null = null
): TimeLogSegment {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    userId: '',
    organizationId: '',
    activityStatusId: status.id,
    statusName: status.name,
    type: status.type,
    colorCode: status.colorCode,
    isBillable: status.isBillable,
    isProductive: status.isProductive,
    startTime: now,
    endTime: null,
    notes,
  };
}

function applyOptimisticClockIn(myDay: MyDayResponse, notes?: string): MyDayResponse {
  const available = findAvailableStatus(myDay.activityStatuses);
  if (!available) return myDay;

  return {
    ...myDay,
    activeSession: {
      activeSegment: buildOptimisticSegment(available, notes ?? null),
    },
  };
}

function applyOptimisticClockOut(myDay: MyDayResponse): MyDayResponse {
  return {
    ...myDay,
    activeSession: null,
  };
}

function applyOptimisticStatus(
  myDay: MyDayResponse,
  status: ActivityStatusOption
): MyDayResponse {
  const current = myDay.activeSession?.activeSegment;
  if (!current) return myDay;

  return {
    ...myDay,
    activeSession: {
      activeSegment: {
        ...current,
        activityStatusId: status.id,
        statusName: status.name,
        type: status.type,
        colorCode: status.colorCode,
        isBillable: status.isBillable,
        isProductive: status.isProductive,
        startTime: new Date().toISOString(),
      },
    },
  };
}

export function useTimeTracking() {
  const isOnline = useOnlineStatus();
  const [myDay, setMyDay] = useState<MyDayResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncErrorCode, setSyncErrorCode] = useState<string | null>(null);

  const session: ActiveSession | null = myDay?.activeSession ?? null;

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({
      date: localTodayDateString(),
    });
    const data = await api.get<MyDayResponse>(`/api/time/my-day?${params.toString()}`);
    setMyDay(data);
  }, []);

  const handleFlushComplete = useCallback(() => {
    setSyncError(null);
    setSyncErrorCode(null);
    void refresh().catch(() => undefined);
  }, [refresh]);

  const handleFlushError = useCallback((message: string, code?: string) => {
    setSyncError(message);
    setSyncErrorCode(code ?? null);
  }, []);

  const { pendingCount, isFlushing, enqueue } = useOfflineMutationQueue({
    isOnline,
    onFlushComplete: handleFlushComplete,
    onFlushError: handleFlushError,
  });

  useEffect(() => {
    if (!isOnline) return;

    const sendHeartbeat = () => {
      void api.post('/api/time/heartbeat').catch(() => undefined);
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 60_000);

    return () => window.clearInterval(intervalId);
  }, [isOnline]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
            setErrorCode(err.code ?? null);
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load time data');
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const runAction = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      setIsSubmitting(true);
      setError(null);
      setErrorCode(null);

      try {
        await action();
        await refresh();
        return true;
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          setErrorCode(err.code ?? null);
        } else {
          setError(err instanceof Error ? err.message : 'Action failed');
        }
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [refresh]
  );

  const runOfflineAction = useCallback(
    async (
      input: {
        type: 'clock-in' | 'clock-out' | 'status';
        payload: Record<string, unknown>;
        idempotencyKey: string;
      },
      optimisticUpdate: (current: MyDayResponse) => MyDayResponse
    ): Promise<boolean> => {
      if (!myDay) {
        setError('Time card data is not loaded yet. Reconnect and try again.');
        return false;
      }

      setIsSubmitting(true);
      setError(null);
      setErrorCode(null);

      try {
        enqueue(input);
        setMyDay(optimisticUpdate(myDay));
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [enqueue, myDay]
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const clearSyncError = useCallback(() => {
    setSyncError(null);
    setSyncErrorCode(null);
  }, []);

  const clockIn = useCallback(
    async (options: ClockInOptions = {}) => {
      const idempotencyKey = crypto.randomUUID();
      const payload = { notes: options.notes };

      if (!isOnline) {
        return runOfflineAction(
          { type: 'clock-in', payload, idempotencyKey },
          (current) => applyOptimisticClockIn(current, options.notes)
        );
      }

      return runAction(async () => {
        await api.post<TimeLogResponse>('/api/time/clock-in', payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });
      });
    },
    [isOnline, runAction, runOfflineAction]
  );

  const clockOut = useCallback(async () => {
    const idempotencyKey = crypto.randomUUID();

    if (!isOnline) {
      return runOfflineAction(
        { type: 'clock-out', payload: {}, idempotencyKey },
        applyOptimisticClockOut
      );
    }

    return runAction(async () => {
      await api.post<TimeLogResponse>('/api/time/clock-out', undefined, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    });
  }, [isOnline, runAction, runOfflineAction]);

  const setAvailable = useCallback(async () => {
    const idempotencyKey = crypto.randomUUID();
    const payload = {};

    if (!isOnline) {
      return runOfflineAction(
        { type: 'status', payload, idempotencyKey },
        (current) => {
          const available = findAvailableStatus(current.activityStatuses);
          return available ? applyOptimisticStatus(current, available) : current;
        }
      );
    }

    return runAction(async () => {
      await api.post<SetStatusResponse>('/api/time/status', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
    });
  }, [isOnline, runAction, runOfflineAction]);

  const setStatus = useCallback(
    async (status: Pick<ActivityStatusOption, 'id' | 'name'>) => {
      const idempotencyKey = crypto.randomUUID();
      const payload = { statusId: status.id };

      if (!isOnline) {
        return runOfflineAction(
          { type: 'status', payload, idempotencyKey },
          (current) => {
            const fullStatus =
              current.activityStatuses.find((option) => option.id === status.id) ??
              ({
                id: status.id,
                name: status.name,
                type: 'PRODUCTIVE',
                colorCode: '#6366f1',
                isBillable: true,
                isProductive: true,
              } satisfies ActivityStatusOption);
            return applyOptimisticStatus(current, fullStatus);
          }
        );
      }

      return runAction(async () => {
        await api.post<SetStatusResponse>('/api/time/status', payload, {
          headers: { 'Idempotency-Key': idempotencyKey },
        });
      });
    },
    [isOnline, runAction, runOfflineAction]
  );

  return {
    myDay,
    session,
    isLoading,
    isSubmitting: isSubmitting || isFlushing,
    isOnline,
    pendingCount,
    error,
    errorCode,
    syncError,
    syncErrorCode,
    clearError,
    clearSyncError,
    clockIn,
    clockOut,
    setAvailable,
    setStatus,
    refresh,
  };
}
