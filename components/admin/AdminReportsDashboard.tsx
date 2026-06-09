'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableSectionTitle,
  TableShell,
} from '@/components/ui/Table';
import { Toast, ToastStack } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  buildTimesheetsCsv,
  defaultDateRange,
  downloadCsv,
  formatDateLocal,
} from '@/lib/utils/admin-metrics';
import { TimesheetRow, TimesheetsResponse } from '@/types/admin-dashboard';

const inputClassName =
  'rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand-accent/30';

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function AdminReportsDashboard() {
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [timesheetRows, setTimesheetRows] = useState<TimesheetRow[]>([]);
  const [timesheetsLoading, setTimesheetsLoading] = useState(false);
  const [timesheetsLoaded, setTimesheetsLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; code?: string | null } | null>(null);

  const fetchTimesheets = useCallback(async () => {
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    return api.get<TimesheetsResponse>(`/api/admin/timesheets?${params.toString()}`);
  }, [dateRange]);

  const handleLoadTimesheets = useCallback(async () => {
    setTimesheetsLoading(true);
    setTimesheetsLoaded(false);
    try {
      const data = await fetchTimesheets();
      setTimesheetRows(data.rows);
      setTimesheetsLoaded(true);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to load timesheets',
        code: err instanceof ApiError ? err.code : undefined,
      });
    } finally {
      setTimesheetsLoading(false);
    }
  }, [fetchTimesheets]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      let rows = timesheetRows;
      if (!timesheetsLoaded || rows.length === 0) {
        const data = await fetchTimesheets();
        rows = data.rows;
      }

      const csv = buildTimesheetsCsv(
        rows.map((row) => ({
          date: formatDateLocal(row.clockIn),
          employeeName: row.employeeName,
          clockIn: row.clockInFormatted,
          clockOut: row.clockOutFormatted,
          breakDeductions: row.breakDeductions,
          netWorkHours: row.netWorkHours,
        }))
      );

      downloadCsv(`timesheets_${dateRange.startDate}_${dateRange.endDate}.csv`, csv);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Export failed',
        code: err instanceof ApiError ? err.code : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  }, [dateRange, fetchTimesheets, timesheetRows, timesheetsLoaded]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <DashboardHeader
          eyebrow="Organization Admin"
          title="Reports & Export"
          subtitle="Timesheet review and CSV export for payroll and compliance"
          actions={
            <Link
              href="/admin/overview"
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-brand-accent/10 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Back to Floor Monitor
            </Link>
          }
        />

        <section>
          <TableSectionTitle title="Timesheets" />
          <div className="mb-4 flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(event) => {
                  setTimesheetsLoaded(false);
                  setDateRange((prev) => ({ ...prev, startDate: event.target.value }));
                }}
                className={inputClassName}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(event) => {
                  setTimesheetsLoaded(false);
                  setDateRange((prev) => ({ ...prev, endDate: event.target.value }));
                }}
                className={inputClassName}
              />
            </div>
            <button
              type="button"
              onClick={handleLoadTimesheets}
              disabled={timesheetsLoading}
              className="rounded-lg bg-brand-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {timesheetsLoading ? 'Loading…' : 'Load'}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="rounded-lg border border-border bg-background px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-brand-accent/10 disabled:opacity-50"
            >
              {isExporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>

          <TableShell>
            {timesheetsLoading ? (
              <TableSkeleton />
            ) : (
              <Table minWidth="720px">
                <TableHead>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Employee</TableHeaderCell>
                  <TableHeaderCell>Clock In</TableHeaderCell>
                  <TableHeaderCell>Clock Out</TableHeaderCell>
                  <TableHeaderCell>Break Deductions</TableHeaderCell>
                  <TableHeaderCell>Net Hours</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {timesheetsLoaded && timesheetRows.length > 0 ? (
                    timesheetRows.map((row) => (
                      <TableRow key={row.timeLogId}>
                        <TableCell>{formatDateLocal(row.clockIn)}</TableCell>
                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                        <TableCell>{row.clockInFormatted}</TableCell>
                        <TableCell>{row.clockOutFormatted}</TableCell>
                        <TableCell>{row.breakDeductions}</TableCell>
                        <TableCell className="font-mono tabular-nums">{row.netWorkHours}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyState
                      message={
                        timesheetsLoaded
                          ? 'No timesheet records for this date range.'
                          : 'Select a date range and click Load to view timesheets.'
                      }
                    />
                  )}
                </TableBody>
              </Table>
            )}
          </TableShell>
        </section>
      </div>

      {toast && (
        <ToastStack>
          <Toast
            message={toast.message}
            code={toast.code}
            variant="error"
            onDismiss={() => setToast(null)}
          />
        </ToastStack>
      )}
    </div>
  );
}
