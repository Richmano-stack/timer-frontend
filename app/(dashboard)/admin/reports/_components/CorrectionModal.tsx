'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { reportsKeys } from '@/app/(dashboard)/admin/reports/_components/query-keys';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type {
  ListTimeLogAuditsResult,
  PatchTimesheetResult,
  TimeLogCorrectionSnapshot,
} from '@/lib/services/timesheet-correction.service';
import {
  formatDateInTimezone,
  formatTimeInTimezone,
} from '@/lib/utils/admin-metrics';
import type { TimesheetRow } from '@/types/admin-dashboard';

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function isoToDatetimeLocal(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

function getTimezoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  const hour = Number(parts.hour === '24' ? '0' : parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - instant.getTime();
}

function datetimeLocalToIso(value: string, timeZone: string): string | null {
  if (!DATETIME_LOCAL_PATTERN.test(value)) return null;
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = getTimezoneOffsetMs(new Date(utcMs), timeZone);
    utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offset;
  }

  return new Date(utcMs).toISOString();
}

function formatSnapshotSummary(
  snapshot: TimeLogCorrectionSnapshot,
  timeZone: string
): string {
  const parts: string[] = [];
  if (snapshot.startTime) {
    parts.push(
      `In ${formatTimeInTimezone(snapshot.startTime, timeZone)}`
    );
  }
  if (snapshot.endTime) {
    parts.push(
      `Out ${formatTimeInTimezone(snapshot.endTime, timeZone)}`
    );
  } else if (snapshot.startTime) {
    parts.push('Out —');
  }
  if (snapshot.notes) {
    parts.push(`Notes: ${snapshot.notes}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function formatAuditTimestamp(iso: string, timeZone: string): string {
  return `${formatDateInTimezone(iso, timeZone)} ${formatTimeInTimezone(iso, timeZone)}`;
}

function ConfirmCorrectionDialog({
  open,
  employeeName,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  employeeName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, isSubmitting, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close confirmation"
        disabled={isSubmitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="correction-confirm-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h4 id="correction-confirm-title" className="text-lg font-semibold text-foreground">
          Save timesheet correction?
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This will permanently update {employeeName}&apos;s shift record and append an audit entry
          with your justification.
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Confirm save'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: TimesheetRow;
  orgTimezone: string;
  onSuccess: () => void;
}

function CorrectionModalContent({
  row,
  orgTimezone,
  onOpenChange,
  onSuccess,
}: Omit<CorrectionModalProps, 'open'>) {
  const queryClient = useQueryClient();
  const [clockInLocal, setClockInLocal] = useState(() =>
    isoToDatetimeLocal(row.clockIn, orgTimezone)
  );
  const [clockOutLocal, setClockOutLocal] = useState(() =>
    row.clockOut ? isoToDatetimeLocal(row.clockOut, orgTimezone) : ''
  );
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);

  const auditsQuery = useQuery({
    queryKey: ['reports', 'correction-audits', row.timeLogId],
    queryFn: () =>
      api.get<ListTimeLogAuditsResult>(
        `/api/admin/timesheets/${row.timeLogId}/audits`
      ),
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<PatchTimesheetResult>(
        `/api/admin/timesheets/${row.timeLogId}`,
        body
      ),
    onSuccess: async () => {
      setShowConfirm(false);
      setPendingPayload(null);
      await queryClient.invalidateQueries({
        queryKey: reportsKeys.all,
      });
      onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      setShowConfirm(false);
      setApiError(err instanceof ApiError ? err.message : 'Failed to save correction');
    },
  });

  const handleClose = useCallback(() => {
    if (patchMutation.isPending) return;
    onOpenChange(false);
  }, [onOpenChange, patchMutation.isPending]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !patchMutation.isPending && !showConfirm) {
        handleClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleClose, patchMutation.isPending, showConfirm]);

  const buildPayload = useCallback((): Record<string, unknown> | null => {
    setValidationError(null);
    setApiError(null);

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10) {
      setValidationError('Justification must be at least 10 characters.');
      return null;
    }

    const clockInIso = datetimeLocalToIso(clockInLocal, orgTimezone);
    if (!clockInIso) {
      setValidationError('Clock in must be a valid date and time.');
      return null;
    }

    let clockOutIso: string | null | undefined;
    if (clockOutLocal.trim() === '') {
      clockOutIso = row.clockOut === null ? undefined : null;
    } else {
      const parsed = datetimeLocalToIso(clockOutLocal, orgTimezone);
      if (!parsed) {
        setValidationError('Clock out must be a valid date and time.');
        return null;
      }
      clockOutIso = parsed;
    }

    const payload: Record<string, unknown> = { reason: trimmedReason };
    let hasChange = false;

    if (clockInIso !== row.clockIn) {
      payload.clockIn = clockInIso;
      hasChange = true;
    }

    if (clockOutIso !== undefined) {
      const currentOut = row.clockOut;
      if (clockOutIso !== currentOut) {
        payload.clockOut = clockOutIso;
        hasChange = true;
      }
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > 0) {
      payload.notes = trimmedNotes;
      hasChange = true;
    }

    if (!hasChange) {
      setValidationError('Change at least one of clock in, clock out, or notes.');
      return null;
    }

    return payload;
  }, [clockInLocal, clockOutLocal, notes, orgTimezone, reason, row]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) return;
    setPendingPayload(payload);
    setShowConfirm(true);
  };

  const handleConfirmSave = () => {
    if (!pendingPayload) return;
    patchMutation.mutate(pendingPayload);
  };

  const auditRows = useMemo(() => {
    const entries = auditsQuery.data?.audits ?? [];
    return entries.map((audit) => ({
      id: audit.id,
      actorLabel: audit.actorLabel,
      timestamp: formatAuditTimestamp(audit.createdAt, orgTimezone),
      before: formatSnapshotSummary(audit.before, orgTimezone),
      after: formatSnapshotSummary(audit.after, orgTimezone),
      reason: audit.reason,
    }));
  }, [auditsQuery.data?.audits, orgTimezone]);

  const displayError = validationError ?? apiError;
  const isSubmitting = patchMutation.isPending;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          onClick={handleClose}
          aria-label="Close dialog"
          disabled={isSubmitting}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="correction-modal-title"
          className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border p-6 pb-4">
            <div>
              <h3 id="correction-modal-title" className="text-lg font-semibold text-foreground">
                Correct timesheet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.employeeName} ·{' '}
                {formatDateInTimezone(row.clockIn, orgTimezone)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label="Close"
            >
              <X />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6 pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="correction-clock-in">Clock in</Label>
                  <Input
                    id="correction-clock-in"
                    type="datetime-local"
                    value={clockInLocal}
                    onChange={(event) => setClockInLocal(event.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="correction-clock-out">Clock out</Label>
                  <Input
                    id="correction-clock-out"
                    type="datetime-local"
                    value={clockOutLocal}
                    onChange={(event) => setClockOutLocal(event.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to clear clock out (open shift).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="correction-notes">Notes</Label>
                <textarea
                  id="correction-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={isSubmitting}
                  rows={2}
                  placeholder="Optional shift notes"
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="correction-reason">
                  Justification <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="correction-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  required
                  minLength={10}
                  placeholder="Explain why this correction is needed (min. 10 characters)"
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
                />
              </div>

              {displayError && (
                <Alert variant="destructive">
                  <AlertDescription>{displayError}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  Review &amp; save
                </Button>
              </div>
            </form>

            <div className="mt-8">
              <h4 className="text-sm font-semibold text-foreground">Correction history</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Read-only audit log for this shift ({orgTimezone})
              </p>

              {auditsQuery.isError ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>
                    {auditsQuery.error instanceof ApiError
                      ? auditsQuery.error.message
                      : 'Failed to load audit history.'}
                  </AlertDescription>
                </Alert>
              ) : (
                <TableShell className="mt-4">
                  <Table minWidth="640px">
                    <TableHead>
                      <TableHeaderCell>When</TableHeaderCell>
                      <TableHeaderCell>Actor</TableHeaderCell>
                      <TableHeaderCell>Before</TableHeaderCell>
                      <TableHeaderCell>After</TableHeaderCell>
                      <TableHeaderCell>Reason</TableHeaderCell>
                    </TableHead>
                    <TableBody>
                      {auditsQuery.isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-muted-foreground">
                            Loading audit history…
                          </TableCell>
                        </TableRow>
                      ) : auditRows.length > 0 ? (
                        auditRows.map((audit) => (
                          <TableRow key={audit.id}>
                            <TableCell className="whitespace-nowrap text-xs">
                              {audit.timestamp}
                            </TableCell>
                            <TableCell className="text-sm">{audit.actorLabel}</TableCell>
                            <TableCell className="max-w-[180px] text-xs text-muted-foreground">
                              {audit.before}
                            </TableCell>
                            <TableCell className="max-w-[180px] text-xs">
                              {audit.after}
                            </TableCell>
                            <TableCell className="max-w-[200px] text-xs">{audit.reason}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableEmptyState message="No prior corrections for this shift." />
                      )}
                    </TableBody>
                  </Table>
                </TableShell>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmCorrectionDialog
        open={showConfirm}
        employeeName={row.employeeName}
        isSubmitting={isSubmitting}
        onClose={() => {
          if (!isSubmitting) {
            setShowConfirm(false);
            setPendingPayload(null);
          }
        }}
        onConfirm={handleConfirmSave}
      />
    </>
  );
}

export function CorrectionModal({
  open,
  onOpenChange,
  row,
  orgTimezone,
  onSuccess,
}: CorrectionModalProps) {
  if (!open) return null;

  return (
    <CorrectionModalContent
      key={row.timeLogId}
      row={row}
      orgTimezone={orgTimezone}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}
