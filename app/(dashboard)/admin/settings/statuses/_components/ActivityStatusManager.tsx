'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusType } from '@prisma/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  ActivityStatusFormModal,
  type ActivityStatusFormValues,
} from './ActivityStatusFormModal';
import { activityStatusKeys } from './query-keys';
import { STATUS_TYPE_LABELS } from './status-type-labels';

interface ActivityStatus {
  id: string;
  name: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
  isProductive: boolean;
}

type ToastState = {
  message: string;
  variant: 'error' | 'success';
};

type FormModalState =
  | { mode: 'create' }
  | { mode: 'edit'; status: ActivityStatus }
  | null;

type DeleteModalState = {
  status: ActivityStatus;
} | null;

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function DeleteConfirmModal({
  open,
  statusName,
  isSubmitting,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  statusName: string;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, isSubmitting, onClose]);

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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-status-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h3 id="delete-status-title" className="text-lg font-semibold text-foreground">
          Delete activity status?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Permanently remove <span className="font-medium text-foreground">{statusName}</span>{' '}
          from your organization. This cannot be undone.
        </p>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActivityStatusManager() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [formModal, setFormModal] = useState<FormModalState>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const statusesQuery = useQuery({
    queryKey: activityStatusKeys.list(),
    queryFn: () => api.get<ActivityStatus[]>('/api/organization/activity-statuses'),
  });

  const invalidateStatuses = () => {
    void queryClient.invalidateQueries({ queryKey: activityStatusKeys.list() });
  };

  const createMutation = useMutation({
    mutationFn: (values: ActivityStatusFormValues) =>
      api.post<ActivityStatus>('/api/organization/activity-statuses', values),
    onSuccess: (created) => {
      setFormModal(null);
      setFormError(null);
      setToast({ message: `Created "${created.name}".`, variant: 'success' });
      invalidateStatuses();
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiError ? err.message : 'Failed to create activity status.'
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: ActivityStatusFormValues;
    }) => api.patch<ActivityStatus>(`/api/organization/activity-statuses/${id}`, values),
    onSuccess: (updated) => {
      setFormModal(null);
      setFormError(null);
      setToast({ message: `Updated "${updated.name}".`, variant: 'success' });
      invalidateStatuses();
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiError ? err.message : 'Failed to update activity status.'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<ActivityStatus>(`/api/organization/activity-statuses/${id}`),
    onSuccess: (deleted) => {
      setDeleteModal(null);
      setDeleteError(null);
      setToast({ message: `Deleted "${deleted.name}".`, variant: 'success' });
      invalidateStatuses();
    },
    onError: (err) => {
      setDeleteError(
        err instanceof ApiError ? err.message : 'Failed to delete activity status.'
      );
    },
  });

  const statuses = statusesQuery.data ?? [];
  const formSubmitting = createMutation.isPending || updateMutation.isPending;
  const formOpen = formModal !== null;
  const formMode = formModal?.mode ?? 'create';
  const editingStatus = formModal?.mode === 'edit' ? formModal.status : undefined;

  const handleFormSubmit = (values: ActivityStatusFormValues) => {
    setFormError(null);
    if (formModal?.mode === 'edit') {
      updateMutation.mutate({ id: formModal.status.id, values });
      return;
    }
    createMutation.mutate(values);
  };

  const handleDeleteConfirm = () => {
    if (!deleteModal) return;
    setDeleteError(null);
    deleteMutation.mutate(deleteModal.status.id);
  };

  return (
    <>
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <div className="mb-8">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
              <Link href="/admin/settings">
                <ArrowLeft data-icon="inline-start" />
                Back to settings
              </Link>
            </Button>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Organization
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Activity statuses</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage trackable employee states, display colors, and billable flags
            </p>
          </div>

          {statusesQuery.error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {statusesQuery.error instanceof ApiError
                  ? statusesQuery.error.message
                  : 'Failed to load activity statuses'}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Status catalog</CardTitle>
                <CardDescription>
                  Employees select these states when clocking in or changing activity during a shift
                </CardDescription>
              </div>
              <Button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setFormModal({ mode: 'create' });
                }}
                disabled={statusesQuery.isLoading}
              >
                <Plus data-icon="inline-start" />
                Add status
              </Button>
            </CardHeader>

            <CardContent className="px-0 pb-0">
              <TableShell>
                {statusesQuery.isLoading ? (
                  <TableSkeleton />
                ) : (
                  <Table>
                    <TableHead>
                      <TableHeaderCell>Name</TableHeaderCell>
                      <TableHeaderCell>Type</TableHeaderCell>
                      <TableHeaderCell>Color</TableHeaderCell>
                      <TableHeaderCell>Billable</TableHeaderCell>
                      <TableHeaderCell className="w-28">Actions</TableHeaderCell>
                    </TableHead>
                    <TableBody>
                      {statuses.length > 0 ? (
                        statuses.map((status) => (
                          <TableRow key={status.id}>
                            <TableCell className="font-medium">{status.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {STATUS_TYPE_LABELS[status.type]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-block h-5 w-5 shrink-0 rounded-md border border-border"
                                  style={{ backgroundColor: status.colorCode }}
                                  aria-hidden
                                />
                                <span className="font-mono text-xs text-muted-foreground">
                                  {status.colorCode}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.isBillable ? 'default' : 'outline'}>
                                {status.isBillable ? 'Billable' : 'Non-billable'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${status.name}`}
                                  disabled={formSubmitting || deleteMutation.isPending}
                                  onClick={() => {
                                    setFormError(null);
                                    setFormModal({ mode: 'edit', status });
                                  }}
                                >
                                  <Pencil />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${status.name}`}
                                  disabled={formSubmitting || deleteMutation.isPending}
                                  onClick={() => {
                                    setDeleteError(null);
                                    setDeleteModal({ status });
                                  }}
                                >
                                  <Trash2 />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableEmptyState message="No activity statuses configured yet." />
                      )}
                    </TableBody>
                  </Table>
                )}
              </TableShell>
            </CardContent>
          </Card>
        </div>
      </div>

      <ActivityStatusFormModal
        open={formOpen}
        mode={formMode}
        instanceKey={editingStatus?.id ?? 'create'}
        initialValues={
          editingStatus
            ? {
                name: editingStatus.name,
                type: editingStatus.type,
                colorCode: editingStatus.colorCode,
                isBillable: editingStatus.isBillable,
              }
            : undefined
        }
        isSubmitting={formSubmitting}
        error={formError}
        onClose={() => {
          if (!formSubmitting) {
            setFormModal(null);
            setFormError(null);
          }
        }}
        onSubmit={handleFormSubmit}
      />

      <DeleteConfirmModal
        open={deleteModal !== null}
        statusName={deleteModal?.status.name ?? ''}
        isSubmitting={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteModal(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
      />

      <ToastStack>
        {toast && (
          <Toast
            message={toast.message}
            variant={toast.variant}
            onDismiss={() => setToast(null)}
          />
        )}
      </ToastStack>
    </>
  );
}
