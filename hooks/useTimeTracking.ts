'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  ActivityStatusOption,
  MyDayResponse,
  SetStatusResponse,
  TimeLogResponse,
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

export function useTimeTracking() {
  const [myDay, setMyDay] = useState<MyDayResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const session: ActiveSession | null = myDay?.activeSession ?? null;

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({
      date: localTodayDateString(),
    });
    const data = await api.get<MyDayResponse>(`/api/time/my-day?${params.toString()}`);
    setMyDay(data);
  }, []);

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

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const idempotencyHeaders = useCallback((): Record<string, string> => {
    return { 'Idempotency-Key': crypto.randomUUID() };
  }, []);

  const clockIn = useCallback(
    async (options: ClockInOptions = {}) => {
      return runAction(async () => {
        await api.post<TimeLogResponse>(
          '/api/time/clock-in',
          { notes: options.notes },
          { headers: idempotencyHeaders() }
        );
      });
    },
    [runAction, idempotencyHeaders]
  );

  const clockOut = useCallback(async () => {
    return runAction(async () => {
      await api.post<TimeLogResponse>('/api/time/clock-out', undefined, {
        headers: idempotencyHeaders(),
      });
    });
  }, [runAction, idempotencyHeaders]);

  const setAvailable = useCallback(async () => {
    return runAction(async () => {
      await api.post<SetStatusResponse>(
        '/api/time/status',
        {},
        { headers: idempotencyHeaders() }
      );
    });
  }, [runAction, idempotencyHeaders]);

  const setStatus = useCallback(
    async (status: Pick<ActivityStatusOption, 'id' | 'name'>) => {
      return runAction(async () => {
        await api.post<SetStatusResponse>(
          '/api/time/status',
          { statusId: status.id },
          { headers: idempotencyHeaders() }
        );
      });
    },
    [runAction, idempotencyHeaders]
  );

  return {
    myDay,
    session,
    isLoading,
    isSubmitting,
    error,
    errorCode,
    clearError,
    clockIn,
    clockOut,
    setAvailable,
    setStatus,
    refresh,
  };
}
