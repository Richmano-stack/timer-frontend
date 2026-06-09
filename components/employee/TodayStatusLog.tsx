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
import { cn } from '@/lib/utils';

function productiveLabel(value: boolean | null): string {
  if (value === null) return '—';
  return value ? 'Yes' : 'No';
}

function rowClass(kind: MyDayTimelineEvent['kind'], isProductive: boolean | null): string {
  if (kind === 'shift_start' || kind === 'shift_end') return 'text-muted-foreground';
  if (isProductive === false) return 'bg-background';
  return '';
}

export function TodayStatusLog({
  timeline,
  isLoading,
  currentLabel,
  isRunning,
}: {
  timeline: MyDayTimelineEvent[] | undefined;
  isLoading: boolean;
  currentLabel: string;
  isRunning: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Shift Status Log
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Full history for the current shift, including status changes since clock-in.
            </p>
          </div>
          <p
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-300',
              isRunning
                ? 'border-brand-accent/30 bg-brand-accent/10 text-indigo-600 dark:text-indigo-400'
                : 'border-border bg-background text-slate-500 dark:text-slate-400'
            )}
          >
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
                  <TableEmptyState message="No shift activity recorded yet." />
                )}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </div>
    </div>
  );
}
