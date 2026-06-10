'use client';

import { useCallback, useEffect, useState } from 'react';
import { TimerSidebarPanel } from '@/components/employee/TimerSidebarPanel';
import { TodayStatusLog } from '@/components/employee/TodayStatusLog';
import { EmployeeShell } from '@/components/layout/EmployeeShell';
import { Toast, ToastStack } from '@/components/ui/Toast';
import { authClient } from '@/lib/auth-client';
import { localTodayDateString, useTimeTracking } from '@/hooks/useTimeTracking';
import {
  getEmployeeDisplayStatus,
  getStatusSinceIso,
} from '@/lib/utils/employee-status';
import { formatElapsed, formatShiftStarted } from '@/lib/utils/format-time';
import { cn } from '@/lib/utils';
import { ActivityStatusOption } from '@/types/time-tracking';

type ToastState = {
  message: string;
  code?: string | null;
  variant: 'error' | 'success';
};

function ClockOutConfirmModal({
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
        disabled={isSubmitting}
      />
      <div className="relative w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-bold text-foreground">Confirm clock out?</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This ends your shift and closes any open status. You can clock back in when you return.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Clocking out…' : 'Clock Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusStrip({
  session,
  isLoading,
  date,
}: {
  session: ReturnType<typeof useTimeTracking>['session'];
  isLoading: boolean;
  date: string;
}) {
  const display = getEmployeeDisplayStatus(session);
  const since = getStatusSinceIso(session);
  const isRunning = display.isOnShift;

  return (
    <div className="border-b border-border bg-card px-6 py-4">
      {isLoading ? (
        <div className="h-8 w-64 animate-pulse rounded bg-border/60" />
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {date}
          </p>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Live Status
          </p>
          <p
            className={cn(
              'text-xl font-black tracking-tight transition-colors duration-300',
              isRunning ? 'text-foreground' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            {display.label}
          </p>
          {since && isRunning && (
            <>
              <p
                className={cn(
                  'font-mono text-lg tabular-nums transition-colors duration-300',
                  'timer-running'
                )}
              >
                <LiveElapsed since={since} />
              </p>
              <p className="text-sm text-muted-foreground">
                Since {formatShiftStarted(since)}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LiveElapsed({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(since));

  useEffect(() => {
    const tick = () => setElapsed(formatElapsed(since));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return <>{elapsed}</>;
}

export function TimeCardDashboard() {
  const {
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
  } = useTimeTracking();

  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const display = getEmployeeDisplayStatus(session);

  const errorToast: ToastState | null = error
    ? { message: error, code: errorCode, variant: 'error' }
    : null;
  const activeToast = toast ?? errorToast;

  const showSuccess = useCallback((message: string) => {
    setToast({ message, variant: 'success' });
  }, []);

  const handleClockIn = useCallback(async () => {
    const ok = await clockIn();
    if (ok) showSuccess('Clocked in successfully.');
  }, [clockIn, showSuccess]);

  const handleConfirmClockOut = useCallback(async () => {
    const ok = await clockOut();
    if (ok) {
      setShowClockOutModal(false);
      showSuccess('Clocked out successfully.');
    }
  }, [clockOut, showSuccess]);

  const handleClockOutClick = useCallback(() => {
    setShowClockOutModal(true);
  }, []);

  const handleSetAvailable = useCallback(async () => {
    const ok = await setAvailable();
    if (ok) showSuccess('Status set to Available.');
  }, [setAvailable, showSuccess]);

  const handleSetStatus = useCallback(
    async (status: ActivityStatusOption) => {
      const ok = await setStatus(status);
      if (ok) showSuccess(`Status set to ${status.name}.`);
    },
    [setStatus, showSuccess]
  );

  const handleLogout = useCallback(async () => {
    await authClient.signOut();
    window.location.href = '/login';
  }, []);

  const employeeName = myDay?.employeeName ?? 'Employee';
  const date = myDay?.date ?? localTodayDateString();

  return (
    <EmployeeShell
      onLogout={handleLogout}
      sidebarPanel={
        <TimerSidebarPanel
          employeeName={employeeName}
          session={session}
          activityStatuses={myDay?.activityStatuses ?? []}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          onClockIn={handleClockIn}
          onClockOut={handleClockOutClick}
          onSetAvailable={handleSetAvailable}
          onSetStatus={handleSetStatus}
        />
      }
    >
      <StatusStrip session={session} isLoading={isLoading} date={date} />
      <TodayStatusLog
        timeline={myDay?.timeline}
        isLoading={isLoading}
        currentLabel={display.label}
        isRunning={display.isOnShift}
      />

      <ClockOutConfirmModal
        open={showClockOutModal}
        onClose={() => setShowClockOutModal(false)}
        onConfirm={handleConfirmClockOut}
        isSubmitting={isSubmitting}
      />

      {activeToast && (
        <ToastStack>
          <Toast
            message={activeToast.message}
            code={activeToast.code}
            variant={activeToast.variant}
            onDismiss={() => {
              if (toast) {
                setToast(null);
              } else {
                clearError();
              }
            }}
          />
        </ToastStack>
      )}
    </EmployeeShell>
  );
}
