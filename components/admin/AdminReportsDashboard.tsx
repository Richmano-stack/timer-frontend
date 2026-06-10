'use client';

import { useCallback, useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Toast, ToastStack } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  buildTimesheetsCsv,
  defaultDateRange,
  downloadCsv,
  formatDateLocal,
} from '@/lib/utils/admin-metrics';
import { TimesheetRow, TimesheetsResponse } from '@/types/admin-dashboard';

function parseIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

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

  const startDate = parseIsoDate(dateRange.startDate);
  const endDate = parseIsoDate(dateRange.endDate);

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

  const handleStartDateChange = (startDateValue: string) => {
    setTimesheetsLoaded(false);
    setDateRange((prev) => {
      const next = { ...prev, startDate: startDateValue };
      if (startDateValue > prev.endDate) {
        next.endDate = startDateValue;
      }
      return next;
    });
  };

  const handleEndDateChange = (endDateValue: string) => {
    setTimesheetsLoaded(false);
    setDateRange((prev) => {
      const next = { ...prev, endDate: endDateValue };
      if (endDateValue < prev.startDate) {
        next.startDate = endDateValue;
      }
      return next;
    });
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Organization
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Timesheet review and CSV export for payroll and compliance
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Timesheets</CardTitle>
            <CardDescription>Select a date range, then load or export records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <DatePicker
                id="start-date"
                label="Start date"
                value={dateRange.startDate}
                onChange={handleStartDateChange}
                toDate={endDate}
                disabled={timesheetsLoading || isExporting}
              />
              <DatePicker
                id="end-date"
                label="End date"
                value={dateRange.endDate}
                onChange={handleEndDateChange}
                fromDate={startDate}
                disabled={timesheetsLoading || isExporting}
              />
              <Button
                type="button"
                onClick={handleLoadTimesheets}
                disabled={timesheetsLoading}
              >
                {timesheetsLoading ? 'Loading…' : 'Load'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting…' : 'Export CSV'}
              </Button>
            </div>
          </CardContent>
        </Card>

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
