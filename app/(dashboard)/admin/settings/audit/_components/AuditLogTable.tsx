'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { api, ApiError } from '@/lib/api';
import { AuditAction } from '@/lib/db/audit';
import { organizationKeys } from '../../_components/query-keys';

interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorUserId: string;
  actorEmail: string;
  metadata: unknown | null;
  createdAt: string;
}

const ACTION_FILTER_ALL = 'all';

const ACTION_OPTIONS = [
  { value: AuditAction.INVITATION_SENT, label: 'Invitation sent' },
  { value: AuditAction.INVITATION_ACCEPTED, label: 'Invitation accepted' },
  { value: AuditAction.JOIN_REQUEST_APPROVED, label: 'Join request approved' },
  { value: AuditAction.JOIN_REQUEST_DENIED, label: 'Join request denied' },
  { value: AuditAction.MEMBER_ROLE_CHANGED, label: 'Member role changed' },
  { value: AuditAction.DOMAIN_WHITELIST_UPDATED, label: 'Domain whitelist updated' },
] as const;

const ACTION_LABELS = Object.fromEntries(
  ACTION_OPTIONS.map((option) => [option.value, option.label])
) as Record<string, string>;

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function formatMetadataPreview(metadata: unknown | null): string {
  if (metadata === null || metadata === undefined) {
    return '—';
  }

  try {
    const text = JSON.stringify(metadata);
    return text.length > 80 ? `${text.slice(0, 77)}…` : text;
  } catch {
    return '—';
  }
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

export function AuditLogTable() {
  const [actionFilter, setActionFilter] = useState(ACTION_FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState('');

  const auditLogsQuery = useQuery({
    queryKey: organizationKeys.auditLogs(actionFilter),
    queryFn: () => {
      const params =
        actionFilter === ACTION_FILTER_ALL ? '' : `?action=${encodeURIComponent(actionFilter)}`;
      return api.get<AuditLogEntry[]>(`/api/organization/audit-logs${params}`);
    },
    refetchOnWindowFocus: true,
  });

  const filteredLogs = useMemo(() => {
    const logs = auditLogsQuery.data ?? [];
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return logs;

    return logs.filter((log) => {
      const haystack = [
        log.actorEmail,
        log.action,
        formatActionLabel(log.action),
        log.targetType,
        log.targetId,
        formatMetadataPreview(log.metadata),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [auditLogsQuery.data, searchQuery]);

  const loadError = auditLogsQuery.error;

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-8">
          <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
            <Link href="/admin/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to settings
            </Link>
          </Button>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Compliance
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Audit trail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Read-only security events for your workspace — invitations, join requests, role changes,
            and policy updates
          </p>
        </div>

        {loadError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {loadError instanceof ApiError
                ? loadError.message
                : 'Failed to load audit trail'}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Security events</CardTitle>
            <CardDescription>
              Latest 100 events, newest first · append-only log
            </CardDescription>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="audit-search">Search</Label>
                <Input
                  id="audit-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Filter by actor, action, target, or metadata…"
                />
              </div>
              <div className="w-full space-y-2 sm:w-64">
                <Label htmlFor="audit-action-filter">Action</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger id="audit-action-filter">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ACTION_FILTER_ALL}>All actions</SelectItem>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <TableShell>
              {auditLogsQuery.isLoading ? (
                <TableSkeleton />
              ) : (
                <Table>
                  <TableHead>
                    <TableHeaderCell>Time</TableHeaderCell>
                    <TableHeaderCell>Action</TableHeaderCell>
                    <TableHeaderCell>Actor</TableHeaderCell>
                    <TableHeaderCell>Target</TableHeaderCell>
                    <TableHeaderCell>Metadata</TableHeaderCell>
                  </TableHead>
                  <TableBody>
                    {filteredLogs.length > 0 ? (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs tabular-nums whitespace-nowrap">
                            {formatDateTime(log.createdAt)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatActionLabel(log.action)}
                          </TableCell>
                          <TableCell>{log.actorEmail}</TableCell>
                          <TableCell className="font-mono text-xs">
                            <span className="text-muted-foreground">{log.targetType}</span>
                            <span className="mx-1 text-muted-foreground">·</span>
                            <span className="break-all">{log.targetId}</span>
                          </TableCell>
                          <TableCell
                            className="max-w-xs truncate text-xs text-muted-foreground"
                            title={
                              log.metadata !== null && log.metadata !== undefined
                                ? JSON.stringify(log.metadata)
                                : undefined
                            }
                          >
                            {formatMetadataPreview(log.metadata)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyState
                        message={
                          searchQuery.trim()
                            ? 'No audit events match your search.'
                            : 'No audit events recorded yet.'
                        }
                      />
                    )}
                  </TableBody>
                </Table>
              )}
            </TableShell>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
