'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableShell,
} from '@/components/ui/Table';
import { api, ApiError } from '@/lib/api';
import { localTodayDateString } from '@/hooks/useTimeTracking';
import { MyDayResponse } from '@/types/time-tracking';

const DEV_COMPANY_ID =
  process.env.NEXT_PUBLIC_DEV_COMPANY_ID ?? '00000000-0000-4000-8000-000000000010';

function productiveLabel(value: boolean | null): string {
  if (value === null) return '—';
  return value ? 'Yes' : 'No';
}

export function AgentDetailDrawer({
  open,
  userId,
  onClose,
}: {
  open: boolean;
  userId: string | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MyDayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !userId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          companyId: DEV_COMPANY_ID,
          userId,
          date: localTodayDateString(),
        });
        const result = await api.get<MyDayResponse>(`/api/time/my-day?${params.toString()}`);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load agent log');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-sage/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div className="relative flex h-full w-full max-w-xl flex-col border-l border-mist bg-ice shadow-2xl">
        <div className="flex items-start justify-between border-b border-mist px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sage/50">
              Today&apos;s Status Log
            </p>
            <h3 className="text-lg font-bold text-sage">
              {data?.employeeName ?? 'Agent Details'}
            </h3>
            {data && (
              <p className="mt-1 text-sm text-sage/60">
                {data.date} · On shift {data.summary.gross} · Breaks {data.summary.breaks} · Net{' '}
                {data.summary.net}h
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl text-mauve hover:bg-mauve/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          )}
          {error && <p className="text-sm text-mauve">{error}</p>}
          {!loading && !error && data && (
            <TableShell>
              <Table>
                <TableHead>
                  <TableHeaderCell>Time</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Duration</TableHeaderCell>
                  <TableHeaderCell>Productive</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {data.timeline.length > 0 ? (
                    data.timeline.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono tabular-nums">
                          {event.timeFormatted}
                        </TableCell>
                        <TableCell className="font-medium">{event.label}</TableCell>
                        <TableCell className="font-mono tabular-nums">{event.duration}</TableCell>
                        <TableCell>{productiveLabel(event.isProductive)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyState message="No activity recorded today." />
                  )}
                </TableBody>
              </Table>
            </TableShell>
          )}
        </div>
      </div>
    </div>
  );
}
