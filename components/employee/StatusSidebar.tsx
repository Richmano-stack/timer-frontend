'use client';

import { useEffect, useState } from 'react';
import { ActiveSession, ActivityStatusOption, MyDaySummary } from '@/types/time-tracking';
import {
  AVAILABLE_STATUS_ID,
  getEmployeeDisplayStatus,
  getStatusSinceIso,
  isStatusActive,
  sortActivityStatuses,
} from '@/lib/utils/employee-status';
import { formatElapsed, formatShiftStarted } from '@/lib/utils/format-time';

function ElapsedDisplay({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(since));

  useEffect(() => {
    const tick = () => setElapsed(formatElapsed(since));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return (
    <p className="font-mono text-4xl font-black tabular-nums tracking-tight text-sage">
      {elapsed}
    </p>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-sage/60">{label}</span>
      <span className="font-mono tabular-nums text-sage">{value}</span>
    </div>
  );
}

export function StatusSidebar({
  employeeName,
  date,
  session,
  activityStatuses,
  summary,
  isLoading,
  isSubmitting,
  onClockIn,
  onClockOut,
  onSetAvailable,
  onSetStatus,
}: {
  employeeName: string;
  date: string;
  session: ActiveSession | null;
  activityStatuses: ActivityStatusOption[];
  summary: MyDaySummary | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onSetAvailable: () => void;
  onSetStatus: (status: ActivityStatusOption) => void;
}) {
  const display = getEmployeeDisplayStatus(session);
  const since = getStatusSinceIso(session);
  const sortedStatuses = sortActivityStatuses(activityStatuses);
  const onShift = Boolean(session);

  const panelTone = !onShift
    ? 'border-mist bg-white'
    : display.label === 'Available' || display.isProductive
      ? 'border-sage/20 bg-mint/40'
      : 'border-mauve/30 bg-mauve/10';

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-mist bg-white">
      <div className="border-b border-mist px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-sage/50">Agent Station</p>
        <h1 className="mt-1 text-lg font-bold text-sage">{employeeName}</h1>
        <p className="text-sm text-sage/60">{date}</p>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        <div className={`rounded-lg border p-4 ${panelTone}`}>
          <p className="text-xs font-semibold uppercase tracking-widest text-sage/50">
            Current Status
          </p>
          {isLoading ? (
            <div className="mt-3 h-16 animate-pulse rounded bg-mist/60" />
          ) : (
            <>
              <p className="mt-2 text-2xl font-black tracking-tight text-sage">{display.label}</p>
              {since && onShift ? (
                <>
                  <div className="mt-3">
                    <ElapsedDisplay since={since} />
                  </div>
                  <p className="mt-2 text-xs text-sage/60">Since {formatShiftStarted(since)}</p>
                </>
              ) : (
                <p className="mt-3 text-sm text-sage/60">
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
            className="w-full rounded-lg bg-sage px-4 py-3 text-sm font-bold text-ice transition hover:bg-sage/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Clocking in…' : 'Clock In'}
          </button>
        ) : (
          <>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sage/50">
                Set Status
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onSetAvailable}
                  disabled={isSubmitting || isLoading}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-50 ${
                    isStatusActive(session, AVAILABLE_STATUS_ID)
                      ? 'border-sage bg-sage text-ice shadow-sm'
                      : 'border-mist bg-white text-sage hover:bg-mint/50'
                  }`}
                >
                  Available
                </button>
                {sortedStatuses.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => onSetStatus(status)}
                    disabled={isSubmitting || isLoading}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition disabled:opacity-50 ${
                      isStatusActive(session, status.id, status.name)
                        ? status.isProductive
                          ? 'border-sage bg-sage text-ice shadow-sm'
                          : 'border-mauve bg-mauve text-ice shadow-sm'
                        : status.isProductive
                          ? 'border-mist bg-white text-sage hover:bg-mint/50'
                          : 'border-mauve/30 bg-mauve/5 text-sage hover:bg-mauve/15'
                    }`}
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
              className="mt-auto w-full rounded-lg border border-mauve/40 px-4 py-2.5 text-sm font-semibold text-sage transition hover:bg-mauve/10 disabled:opacity-50"
            >
              Clock Out
            </button>
          </>
        )}

        {summary && onShift && (
          <div className="space-y-2 rounded-lg border border-mist bg-ice/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-sage/50">
              Today
            </p>
            <SummaryRow label="On shift" value={summary.gross} />
            <SummaryRow label="Breaks" value={summary.breaks} />
            <SummaryRow label="Net hrs" value={summary.net} />
          </div>
        )}
      </div>
    </aside>
  );
}
