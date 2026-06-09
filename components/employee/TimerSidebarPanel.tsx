'use client';

import { useEffect, useState } from 'react';
import { ActiveSession, ActivityStatusOption } from '@/types/time-tracking';
import {
  AVAILABLE_STATUS_ID,
  getEmployeeDisplayStatus,
  getStatusSinceIso,
  isStatusActive,
  sortActivityStatuses,
} from '@/lib/utils/employee-status';
import { formatElapsed, formatShiftStarted } from '@/lib/utils/format-time';
import { cn } from '@/lib/utils';

function statusButtonStyle(
  active: boolean,
  colorCode: string
): React.CSSProperties | undefined {
  if (!active) return undefined;
  return {
    borderColor: colorCode,
    backgroundColor: colorCode,
    color: '#ffffff',
  };
}

function ElapsedDisplay({ since, isRunning }: { since: string; isRunning: boolean }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(since));

  useEffect(() => {
    const tick = () => setElapsed(formatElapsed(since));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return (
    <p
      className={cn(
        'font-mono text-3xl font-black tabular-nums tracking-tight transition-colors duration-300',
        isRunning ? 'timer-running' : 'timer-paused'
      )}
    >
      {elapsed}
    </p>
  );
}

export function TimerSidebarPanel({
  employeeName,
  session,
  activityStatuses,
  isLoading,
  isSubmitting,
  onClockIn,
  onClockOut,
  onSetAvailable,
  onSetStatus,
}: {
  employeeName: string;
  session: ActiveSession | null;
  activityStatuses: ActivityStatusOption[];
  isLoading: boolean;
  isSubmitting: boolean;
  onClockIn: () => void | Promise<void>;
  onClockOut: () => void;
  onSetAvailable: () => void | Promise<void>;
  onSetStatus: (status: ActivityStatusOption) => void | Promise<void>;
}) {
  const display = getEmployeeDisplayStatus(session);
  const since = getStatusSinceIso(session);
  const sortedStatuses = sortActivityStatuses(activityStatuses);
  const onShift = Boolean(session?.activeSegment);
  const isRunning = onShift;
  const availableColor =
    activityStatuses.find((status) => status.name === 'Available')?.colorCode ?? '#6366f1';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-white">
          {employeeName.charAt(0).toUpperCase()}
        </div>
        <p className="text-sm font-semibold text-foreground">{employeeName}</p>
      </div>

      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4 transition-shadow duration-300',
          isRunning && 'timer-ring-running'
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Current Status
        </p>
        {isLoading ? (
          <div className="mt-3 h-16 animate-pulse rounded bg-border/60" />
        ) : (
          <>
            <p
              className={cn(
                'mt-2 text-xl font-black tracking-tight transition-colors duration-300',
                isRunning ? 'text-foreground' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {display.label}
            </p>
            {since && onShift ? (
              <>
                <div className="mt-3">
                  <ElapsedDisplay since={since} isRunning={isRunning} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Since {formatShiftStarted(since)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {onShift ? 'Ready for the next status change.' : 'Clock in to start your shift.'}
              </p>
            )}
          </>
        )}
      </div>

      {!onShift ? (
        <button
          type="button"
          onClick={onClockIn}
          disabled={isSubmitting || isLoading}
          className="w-full rounded-lg bg-brand-accent px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Clocking in…' : 'Clock In'}
        </button>
      ) : (
        <>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Set Status
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onSetAvailable}
                disabled={isSubmitting || isLoading}
                style={statusButtonStyle(
                  isStatusActive(session, AVAILABLE_STATUS_ID),
                  availableColor
                )}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-50',
                  isStatusActive(session, AVAILABLE_STATUS_ID)
                    ? 'shadow-sm'
                    : 'border-border bg-card text-foreground hover:bg-background'
                )}
              >
                Available
              </button>
              {sortedStatuses.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => onSetStatus(status)}
                  disabled={isSubmitting || isLoading}
                  style={statusButtonStyle(
                    isStatusActive(session, status.id, status.name),
                    status.colorCode
                  )}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-50',
                    isStatusActive(session, status.id, status.name)
                      ? 'shadow-sm'
                      : 'border-border bg-card text-foreground hover:bg-background'
                  )}
                >
                  {status.name}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClockOut}
            disabled={isSubmitting || isLoading}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-background disabled:opacity-50"
          >
            Clock Out
          </button>
        </>
      )}
    </div>
  );
}
