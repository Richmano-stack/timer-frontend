'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { formatTimezoneLabel } from '@/app/(auth)/onboarding/_components/timezone-options';
import { CorrectionModal } from '@/app/(dashboard)/admin/reports/_components/CorrectionModal';
import { reportsKeys } from '@/app/(dashboard)/admin/reports/_components/query-keys';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  formatDateInTimezone,
  formatTimeInTimezone,
} from '@/lib/utils/admin-metrics';
import { TimesheetsResponse, TimesheetRow } from '@/types/admin-dashboard';

interface OrganizationSettings {
  organizationId: string;
  name: string;
  slug: string;
  timezone: string | null;
  allowedDomains: string[];
  requireApproval: boolean;
}

interface TeamMember {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface TeamResponse {
  members: TeamMember[];
}

type EmployeeSort = 'asc' | 'desc' | null;

const ALL_AGENTS_VALUE = '__all__';

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

function SortableEmployeeHeader({
  sort,
  onToggle,
}: {
  sort: EmployeeSort;
  onToggle: () => void;
}) {
  const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <TableHeaderCell>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      >
        Employee
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="sr-only">
          {sort === 'asc' ? ', sorted ascending' : sort === 'desc' ? ', sorted descending' : ', sortable'}
        </span>
      </button>
    </TableHeaderCell>
  );
}

export function AdminReportsDashboard() {
  const queryClient = useQueryClient();
  const [defaultRange] = useState(defaultDateRange);
  const [dateRange, setDateRange] = useState(defaultRange);
  const [selectedAgentId, setSelectedAgentId] = useState(ALL_AGENTS_VALUE);
  const [employeeSort, setEmployeeSort] = useState<EmployeeSort>(null);
  const [timesheetsLoaded, setTimesheetsLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [correctionRow, setCorrectionRow] = useState<TimesheetRow | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    code?: string | null;
    variant?: 'error' | 'success';
  } | null>(null);

  const startDate = parseIsoDate(dateRange.startDate);
  const endDate = parseIsoDate(dateRange.endDate);

  const settingsQuery = useQuery({
    queryKey: reportsKeys.settings(),
    queryFn: () => api.get<OrganizationSettings>('/api/organization/settings'),
  });

  const teamQuery = useQuery({
    queryKey: reportsKeys.team(),
    queryFn: () => api.get<TeamResponse>('/api/organization/team'),
  });

  const timesheetsQuery = useQuery({
    queryKey: reportsKeys.timesheets(dateRange.startDate, dateRange.endDate),
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      return api.get<TimesheetsResponse>(`/api/admin/timesheets?${params.toString()}`);
    },
    enabled: false,
  });

  const orgTimezone = settingsQuery.data?.timezone ?? 'UTC';
  const timezoneLabel = formatTimezoneLabel(orgTimezone);

  const sortedMembers = useMemo(() => {
    const members = teamQuery.data?.members ?? [];
    return [...members].sort((a, b) =>
      a.user.name.localeCompare(b.user.name, undefined, { sensitivity: 'base' })
    );
  }, [teamQuery.data?.members]);

  const filteredRows = useMemo(() => {
    const rows = timesheetsQuery.data?.rows ?? [];
    if (selectedAgentId === ALL_AGENTS_VALUE) return rows;
    return rows.filter((row) => row.userId === selectedAgentId);
  }, [timesheetsQuery.data?.rows, selectedAgentId]);

  const displayRows = useMemo(() => {
    if (!employeeSort) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const cmp = a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' });
      return employeeSort === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, employeeSort]);

  const hasActiveFilters =
    selectedAgentId !== ALL_AGENTS_VALUE ||
    dateRange.startDate !== defaultRange.startDate ||
    dateRange.endDate !== defaultRange.endDate;

  const fetchTimesheets = useCallback(async () => {
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    });
    return api.get<TimesheetsResponse>(`/api/admin/timesheets?${params.toString()}`);
  }, [dateRange]);

  const handleLoadTimesheets = useCallback(async () => {
    setTimesheetsLoaded(false);
    const result = await timesheetsQuery.refetch();
    if (result.error) {
      setToast({
        message:
          result.error instanceof ApiError ? result.error.message : 'Failed to load timesheets',
        code: result.error instanceof ApiError ? result.error.code : undefined,
      });
      return;
    }
    setTimesheetsLoaded(true);
  }, [timesheetsQuery]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      let rows = displayRows;
      if (!timesheetsLoaded || timesheetsQuery.data === undefined) {
        const data = await fetchTimesheets();
        rows =
          selectedAgentId === ALL_AGENTS_VALUE
            ? data.rows
            : data.rows.filter((row) => row.userId === selectedAgentId);
      }

      const csv = buildTimesheetsCsv(
        rows.map((row) => ({
          date: formatDateInTimezone(row.clockIn, orgTimezone),
          employeeName: row.employeeName,
          clockIn: formatTimeInTimezone(row.clockIn, orgTimezone),
          clockOut: row.clockOut
            ? formatTimeInTimezone(row.clockOut, orgTimezone)
            : '—',
          breakDeductions: row.breakDeductions,
          netWorkHours: row.netWorkHours,
          manuallyEdited: row.manuallyEdited,
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
  }, [
    dateRange,
    displayRows,
    fetchTimesheets,
    orgTimezone,
    selectedAgentId,
    timesheetsLoaded,
    timesheetsQuery.data,
  ]);

  const invalidateLoadedState = () => setTimesheetsLoaded(false);

  const handleStartDateChange = (startDateValue: string) => {
    invalidateLoadedState();
    setDateRange((prev) => {
      const next = { ...prev, startDate: startDateValue };
      if (startDateValue > prev.endDate) {
        next.endDate = startDateValue;
      }
      return next;
    });
  };

  const handleEndDateChange = (endDateValue: string) => {
    invalidateLoadedState();
    setDateRange((prev) => {
      const next = { ...prev, endDate: endDateValue };
      if (endDateValue < prev.startDate) {
        next.startDate = endDateValue;
      }
      return next;
    });
  };

  const handleAgentChange = (value: string) => {
    setSelectedAgentId(value);
  };

  const handleClearFilters = () => {
    setDateRange(defaultRange);
    setSelectedAgentId(ALL_AGENTS_VALUE);
    setEmployeeSort(null);
    invalidateLoadedState();
  };

  const handleEmployeeSortToggle = () => {
    setEmployeeSort((prev) => {
      if (prev === null) return 'asc';
      if (prev === 'asc') return 'desc';
      return null;
    });
  };

  const handleCorrectionSuccess = useCallback(async () => {
    setToast({ message: 'Timesheet correction saved.', variant: 'success' });
    await queryClient.invalidateQueries({ queryKey: reportsKeys.all });
    const result = await timesheetsQuery.refetch();
    if (result.data) {
      setTimesheetsLoaded(true);
    }
  }, [queryClient, timesheetsQuery]);

  const timesheetsLoading = timesheetsQuery.isFetching;
  const timesheetsError = timesheetsQuery.isError
    ? timesheetsQuery.error instanceof ApiError
      ? timesheetsQuery.error.message
      : 'Failed to load timesheets'
    : null;

  const filtersDisabled = timesheetsLoading || isExporting;

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

        {(settingsQuery.isError || teamQuery.isError) && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {settingsQuery.isError
                ? settingsQuery.error instanceof ApiError
                  ? settingsQuery.error.message
                  : 'Failed to load organization settings.'
                : teamQuery.error instanceof ApiError
                  ? teamQuery.error.message
                  : 'Failed to load team members.'}
            </AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Timesheets</CardTitle>
            <CardDescription>
              Select a date range and optional agent filter, then load or export records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <DatePicker
                  id="start-date"
                  label="Start date"
                  value={dateRange.startDate}
                  onChange={handleStartDateChange}
                  toDate={endDate}
                  disabled={filtersDisabled}
                />
                <DatePicker
                  id="end-date"
                  label="End date"
                  value={dateRange.endDate}
                  onChange={handleEndDateChange}
                  fromDate={startDate}
                  disabled={filtersDisabled}
                />
                <div className="flex min-w-[200px] flex-col gap-2">
                  <Label htmlFor="agent-filter">Agent</Label>
                  <Select
                    value={selectedAgentId}
                    onValueChange={handleAgentChange}
                    disabled={filtersDisabled || teamQuery.isLoading}
                  >
                    <SelectTrigger id="agent-filter" className="w-full sm:w-[220px]">
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_AGENTS_VALUE}>All agents</SelectItem>
                      {teamQuery.isLoading ? (
                        <SelectItem value="__loading__" disabled>
                          Loading members…
                        </SelectItem>
                      ) : (
                        sortedMembers.map((member) => (
                          <SelectItem key={member.user.id} value={member.user.id}>
                            {member.user.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={() => void handleLoadTimesheets()}
                  disabled={timesheetsLoading || settingsQuery.isLoading}
                >
                  {timesheetsLoading ? 'Loading…' : 'Load'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleExport()}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting…' : 'Export CSV'}
                </Button>
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClearFilters}
                    disabled={filtersDisabled}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Dates interpreted in {timezoneLabel}. API requests use ISO calendar dates (
                {dateRange.startDate} – {dateRange.endDate}).
              </p>
            </div>
          </CardContent>
        </Card>

        {timesheetsError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{timesheetsError}</AlertDescription>
          </Alert>
        )}

        <TableShell>
          {timesheetsLoading ? (
            <TableSkeleton />
          ) : (
            <Table minWidth="720px">
              <TableHead>
                <TableHeaderCell>Date</TableHeaderCell>
                <SortableEmployeeHeader sort={employeeSort} onToggle={handleEmployeeSortToggle} />
                <TableHeaderCell>Clock In</TableHeaderCell>
                <TableHeaderCell>Clock Out</TableHeaderCell>
                <TableHeaderCell>Break Deductions</TableHeaderCell>
                <TableHeaderCell>Net Hours</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableHead>
              <TableBody>
                {timesheetsLoaded && displayRows.length > 0 ? (
                  displayRows.map((row) => (
                    <TableRow key={row.timeLogId}>
                      <TableCell>{formatDateInTimezone(row.clockIn, orgTimezone)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.employeeName}</span>
                          {row.manuallyEdited && (
                            <Badge variant="outline" className="text-xs">
                              Edited
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatTimeInTimezone(row.clockIn, orgTimezone)}</TableCell>
                      <TableCell>
                        {row.clockOut
                          ? formatTimeInTimezone(row.clockOut, orgTimezone)
                          : '—'}
                      </TableCell>
                      <TableCell>{row.breakDeductions}</TableCell>
                      <TableCell className="font-mono tabular-nums">{row.netWorkHours}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCorrectionRow(row)}
                          aria-label={`Correct timesheet for ${row.employeeName}`}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Correct
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyState
                    message={
                      timesheetsLoaded
                        ? selectedAgentId !== ALL_AGENTS_VALUE
                          ? 'No timesheet records for this agent and date range.'
                          : 'No timesheet records for this date range.'
                        : 'Select a date range and click Load to view timesheets.'
                    }
                  />
                )}
              </TableBody>
            </Table>
          )}
        </TableShell>
      </div>

      {correctionRow && (
        <CorrectionModal
          open={Boolean(correctionRow)}
          onOpenChange={(open) => {
            if (!open) setCorrectionRow(null);
          }}
          row={correctionRow}
          orgTimezone={orgTimezone}
          onSuccess={() => void handleCorrectionSuccess()}
        />
      )}

      {toast && (
        <ToastStack>
          <Toast
            message={toast.message}
            code={toast.code}
            variant={toast.variant ?? 'error'}
            onDismiss={() => setToast(null)}
          />
        </ToastStack>
      )}
    </div>
  );
}
