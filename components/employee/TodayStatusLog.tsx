'use client';

import { MyDayTimelineEvent } from '@/types/time-tracking';
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

function productiveLabel(value: boolean | null): string {
  if (value === null) return '—';
  return value ? 'Yes' : 'No';
}

function rowClass(kind: MyDayTimelineEvent['kind'], isProductive: boolean | null): string {
  if (kind === 'shift_start' || kind === 'shift_end') return 'text-sage/80';
  if (isProductive === false) return 'bg-mauve/5';
  return '';
}

export function TodayStatusLog({
  timeline,
  isLoading,
  currentLabel,
}: {
  timeline: MyDayTimelineEvent[] | undefined;
  isLoading: boolean;
  currentLabel: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-mist px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sage/50">
              Today&apos;s Status Log
            </p>
            <p className="mt-1 text-sm text-sage/70">
              Live view of shift and status changes for audit and self-check.
            </p>
          </div>
          <p className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-sage">
            Now: {currentLabel}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : (
          <TableShell>
            <Table>
              <TableHead>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Duration</TableHeaderCell>
                <TableHeaderCell>Productive</TableHeaderCell>
              </TableHead>
              <TableBody>
                {timeline && timeline.length > 0 ? (
                  timeline.map((event) => (
                    <TableRow
                      key={event.id}
                      className={rowClass(event.kind, event.isProductive)}
                    >
                      <TableCell className="font-mono tabular-nums">
                        {event.timeFormatted}
                      </TableCell>
                      <TableCell className="font-medium">{event.label}</TableCell>
                      <TableCell className="font-mono tabular-nums">{event.duration}</TableCell>
                      <TableCell>{productiveLabel(event.isProductive)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyState message="No status changes recorded today." />
                )}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </div>
    </div>
  );
}
