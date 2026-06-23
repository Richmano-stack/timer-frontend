'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiEnvelope, parseApiResponse } from '@/lib/api';
import { AdminOverviewResponse } from '@/types/admin-dashboard';

export const OVERVIEW_POLL_INTERVAL_MS = 5_000;

const STREAM_URL = '/api/admin/overview/stream';

export type OverviewConnectionMode = 'connecting' | 'live' | 'polling';

export function useOverviewStream({
  onOverview,
  onPoll,
}: {
  onOverview: (data: AdminOverviewResponse) => void;
  onPoll: () => void;
}) {
  const [connectionMode, setConnectionMode] = useState<OverviewConnectionMode>('connecting');
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onOverviewRef = useRef(onOverview);
  const onPollRef = useRef(onPoll);

  useEffect(() => {
    onOverviewRef.current = onOverview;
    onPollRef.current = onPoll;
  });

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    setConnectionMode('polling');
    stopPolling();
    pollIntervalRef.current = setInterval(() => {
      onPollRef.current();
    }, OVERVIEW_POLL_INTERVAL_MS);
  }, [stopPolling]);

  useEffect(() => {
    onPollRef.current();

    const eventSource = new EventSource(STREAM_URL);

    eventSource.onopen = () => {
      setConnectionMode('live');
      stopPolling();
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ApiEnvelope<AdminOverviewResponse>;
        onOverviewRef.current(parseApiResponse(payload));
        setConnectionMode('live');
      } catch {
        // Ignore malformed SSE payloads; polling remains the fallback.
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      startPolling();
    };

    return () => {
      eventSource.close();
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  return { connectionMode };
}
