'use client';

import { useCallback, useEffect, useState } from 'react';
import { StatusSidebar } from '@/components/employee/StatusSidebar';
import { TodayStatusLog } from '@/components/employee/TodayStatusLog';
import { Toast, ToastStack } from '@/components/ui/Toast';
import { localTodayDateString, useTimeTracking } from '@/hooks/useTimeTracking';
import { getEmployeeDisplayStatus } from '@/lib/utils/employee-status';
import { formatElapsed, formatShiftStarted } from '@/lib/utils/format-time';

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
        className="absolute inset-0 bg-sage/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className="relative w-full max-w-md rounded-lg border border-mist bg-ice p-6 shadow-xl">
        <h3 className="text-lg font-bold text-sage">Confirm clock out?</h3>
        <p className="mt-2 text-sm leading-relaxed text-sage/70">
          This ends your shift and closes any open status. You can clock back in when you return.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-mist px-4 py-2.5 text-sm font-medium text-sage transition hover:bg-mint disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-mauve px-4 py-2.5 text-sm font-bold text-ice transition hover:bg-mauve/90 disabled:opacity-50"
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
}: {
  session: ReturnType<typeof useTimeTracking>['session'];
  isLoading: boolean;
}) {
  const display = getEmployeeDisplayStatus(session);
  const since = session?.activeActivity?.startTime ?? session?.timeLog.clockIn ?? null;

  const tone = !display.isOnShift
    ? 'bg-mist text-sage'
    : display.label === 'Available' || display.isProductive
      ? 'bg-sage text-ice'
      : 'bg-mauve text-ice';

  return (
    <div className={`border-b border-mist px-6 py-4 ${tone}`}>
      {isLoading ? (
        <div className="h-8 w-64 animate-pulse rounded bg-white/20" />
      ) : (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest opacity-80">Live Status</p>
          <p className="text-xl font-black tracking-tight">{display.label}</p>
          {since && display.isOnShift && (
            <>
              <p className="font-mono text-lg tabular-nums">
                <LiveElapsed since={since} />
              </p>
              <p className="text-sm opacity-80">Since {formatShiftStarted(since)}</p>
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
  const [toast, setToast] = useState<{
    message: string;
    code?: string | null;
    variant: 'error' | 'success';
  } | null>(null);

  const display = getEmployeeDisplayStatus(session);

  useEffect(() => {
    if (!error) return;
    setToast({ message: error, code: errorCode, variant: 'error' });
    clearError();
  }, [error, errorCode, clearError]);

  const handleClockIn = useCallback(async () => {
    await clockIn({ clockInIp: null, latitude: null, longitude: null });
  }, [clockIn]);

  const handleConfirmClockOut = useCallback(async () => {
    await clockOut();
    setShowClockOutModal(false);
  }, [clockOut]);

  const handleClockOutClick = useCallback(() => {
    setShowClockOutModal(true);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-ice text-sage">
      <StatusSidebar
        employeeName={myDay?.employeeName ?? 'Employee'}
        date={myDay?.date ?? localTodayDateString()}
        session={session}
        activityStatuses={myDay?.activityStatuses ?? []}
        summary={myDay?.summary ?? null}
        isLoading={isLoading}
        isSubmitting={isSubmitting}
        onClockIn={handleClockIn}
        onClockOut={handleClockOutClick}
        onSetAvailable={setAvailable}
        onSetStatus={setStatus}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <StatusStrip session={session} isLoading={isLoading} />
        <TodayStatusLog
          timeline={myDay?.timeline}
          isLoading={isLoading}
          currentLabel={display.label}
        />
      </main>

      <ClockOutConfirmModal
        open={showClockOutModal}
        onClose={() => setShowClockOutModal(false)}
        onConfirm={handleConfirmClockOut}
        isSubmitting={isSubmitting}
      />

      {toast && (
        <ToastStack>
          <Toast
            message={toast.message}
            code={toast.code}
            variant={toast.variant}
            onDismiss={() => setToast(null)}
          />
        </ToastStack>
      )}
    </div>
  );
}
