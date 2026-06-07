'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  ActiveSession,
  ActivityLogResponse,
  ActivityStatusOption,
  MyDayResponse,
  SetStatusResponse,
  TimeLogResponse,
} from '@/types/time-tracking';

const DEV_USER_ID = process.env.NEXT_PUBLIC_DEV_USER_ID ?? '';
const DEV_COMPANY_ID = process.env.NEXT_PUBLIC_DEV_COMPANY_ID ?? '';

function getIdentity() {
  if (!DEV_USER_ID || !DEV_COMPANY_ID) {
    throw new Error('Missing NEXT_PUBLIC_DEV_USER_ID or NEXT_PUBLIC_DEV_COMPANY_ID');
  }

  return { userId: DEV_USER_ID, companyId: DEV_COMPANY_ID };
}

export function localTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ClockInOptions {
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
  clockInIp?: string | null;
}

export interface StartActivityOptions {
  statusId?: string;
  statusName?: string;
}

export function useTimeTracking() {
  const [myDay, setMyDay] = useState<MyDayResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const session: ActiveSession | null = myDay?.activeSession ?? null;

  const refresh = useCallback(async () => {
    const { userId, companyId } = getIdentity();
    const params = new URLSearchParams({
      userId,
      companyId,
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
    async (action: () => Promise<void>) => {
      setIsSubmitting(true);
      setError(null);
      setErrorCode(null);

      try {
        await action();
        await refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          setErrorCode(err.code ?? null);
        } else {
          setError(err instanceof Error ? err.message : 'Action failed');
        }
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

  const clockIn = useCallback(
    async (options: ClockInOptions = {}) => {
      const { userId, companyId } = getIdentity();
      await runAction(async () => {
        await api.post<TimeLogResponse>('/api/time/clock-in', {
          userId,
          companyId,
          notes: options.notes,
          latitude: options.latitude ?? null,
          longitude: options.longitude ?? null,
          clockInIp: options.clockInIp ?? null,
        });
      });
    },
    [runAction]
  );

  const clockOut = useCallback(async () => {
    const { userId, companyId } = getIdentity();
    await runAction(async () => {
      await api.post<TimeLogResponse>('/api/time/clock-out', {
        userId,
        companyId,
        clockOutIp: null,
      });
    });
  }, [runAction]);

  const startBreak = useCallback(
    async (options: StartActivityOptions) => {
      const { userId, companyId } = getIdentity();
      if (!session?.timeLog.id) {
        setError('No active time log found.');
        return;
      }

      await runAction(async () => {
        await api.post<ActivityLogResponse>('/api/time/break', {
          userId,
          companyId,
          timeLogId: session.timeLog.id,
          action: 'START',
          statusId: options.statusId,
          statusName: options.statusName,
        });
      });
    },
    [runAction, session?.timeLog.id]
  );

  const endBreak = useCallback(async () => {
    const { userId, companyId } = getIdentity();
    if (!session?.timeLog.id) {
      setError('No active time log found.');
      return;
    }

    await runAction(async () => {
      await api.post<ActivityLogResponse>('/api/time/break', {
        userId,
        companyId,
        timeLogId: session.timeLog.id,
        action: 'END',
      });
    });
  }, [runAction, session?.timeLog.id]);

  const setAvailable = useCallback(async () => {
    const { userId, companyId } = getIdentity();
    await runAction(async () => {
      await api.post<SetStatusResponse>('/api/time/status', {
        userId,
        companyId,
      });
    });
  }, [runAction]);

  const setStatus = useCallback(
    async (status: Pick<ActivityStatusOption, 'id' | 'name'>) => {
      const { userId, companyId } = getIdentity();
      await runAction(async () => {
        await api.post<SetStatusResponse>('/api/time/status', {
          userId,
          companyId,
          statusId: status.id,
        });
      });
    },
    [runAction]
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
    startBreak,
    endBreak,
    refresh,
  };
}
