'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
import { api, ApiError } from '@/lib/api';
import { formatRoleLabel } from '@/lib/organization/roles';
import { organizationKeys } from './query-keys';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface JoinRequest {
  id: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  createdAt: string;
  reviewedAt: string | null;
}

type TabId = 'invitations' | 'join-requests';

type PendingAction =
  | { type: 'approve'; request: JoinRequest }
  | { type: 'deny'; request: JoinRequest }
  | null;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function JoinRequestStatusBadge({ status }: { status: JoinRequest['status'] }) {
  if (status === 'PENDING') {
    return <Badge variant="secondary">Pending</Badge>;
  }
  if (status === 'APPROVED') {
    return <Badge variant="default">Approved</Badge>;
  }
  return <Badge variant="destructive">Denied</Badge>;
}

function ActionConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  isSubmitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
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
        aria-labelledby="action-confirm-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h3 id="action-confirm-title" className="text-lg font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <Alert className="mt-4">
          <AlertDescription className="text-xs">
            This is a security-sensitive action. It will be recorded in the organization audit
            log when audit logging is enabled (TKT-121).
          </AlertDescription>
        </Alert>
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
            variant={confirmVariant}
            className="flex-1"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RequestsTable({
  onToast,
}: {
  onToast: (toast: { message: string; variant: 'error' | 'success' }) => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('invitations');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const invitationsQuery = useQuery({
    queryKey: organizationKeys.invitations(),
    queryFn: () => api.get<Invitation[]>('/api/organization/invitations'),
    refetchOnWindowFocus: true,
  });

  const joinRequestsQuery = useQuery({
    queryKey: organizationKeys.joinRequests(),
    queryFn: () => api.get<JoinRequest[]>('/api/organization/join-requests'),
    refetchOnWindowFocus: true,
  });

  const invalidatePanelQueries = () => {
    void queryClient.invalidateQueries({ queryKey: organizationKeys.invitations() });
    void queryClient.invalidateQueries({ queryKey: organizationKeys.joinRequests() });
    void queryClient.invalidateQueries({ queryKey: organizationKeys.team() });
  };

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete<Invitation>(`/api/organization/invitations/${invitationId}`),
    onSuccess: () => {
      onToast({ message: 'Invitation revoked.', variant: 'success' });
      invalidatePanelQueries();
    },
    onError: (err) => {
      onToast({
        message: err instanceof ApiError ? err.message : 'Failed to revoke invitation',
        variant: 'error',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (joinRequestId: string) =>
      api.post<{ joinRequestId: string; email: string }>(
        `/api/organization/join-requests/${joinRequestId}/approve`
      ),
    onSuccess: (data) => {
      setPendingAction(null);
      onToast({
        message: `Join request approved for ${data.email}.`,
        variant: 'success',
      });
      invalidatePanelQueries();
    },
    onError: (err) => {
      onToast({
        message: err instanceof ApiError ? err.message : 'Failed to approve join request',
        variant: 'error',
      });
    },
  });

  const denyMutation = useMutation({
    mutationFn: (joinRequestId: string) =>
      api.post<{ joinRequestId: string; email: string }>(
        `/api/organization/join-requests/${joinRequestId}/deny`
      ),
    onSuccess: (data) => {
      setPendingAction(null);
      onToast({
        message: `Join request denied for ${data.email}.`,
        variant: 'success',
      });
      invalidatePanelQueries();
    },
    onError: (err) => {
      onToast({
        message: err instanceof ApiError ? err.message : 'Failed to deny join request',
        variant: 'error',
      });
    },
  });

  const invitations = invitationsQuery.data ?? [];
  const joinRequests = joinRequestsQuery.data ?? [];
  const tabError = invitationsQuery.error ?? joinRequestsQuery.error ?? null;
  const actionPending = approveMutation.isPending || denyMutation.isPending;

  const handleConfirmAction = () => {
    if (!pendingAction) return;
    if (pendingAction.type === 'approve') {
      approveMutation.mutate(pendingAction.request.id);
      return;
    }
    denyMutation.mutate(pendingAction.request.id);
  };

  const modalCopy =
    pendingAction?.type === 'approve'
      ? {
          title: 'Approve join request?',
          description: `Grant ${pendingAction.request.email} access to your organization. They will be able to sign in once their account is linked.`,
          confirmLabel: 'Approve',
          confirmVariant: 'default' as const,
        }
      : pendingAction?.type === 'deny'
        ? {
            title: 'Deny join request?',
            description: `Reject ${pendingAction.request.email}'s request to join. They will not be added to your organization.`,
            confirmLabel: 'Deny',
            confirmVariant: 'destructive' as const,
          }
        : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Access requests</CardTitle>
          <CardDescription>
            Review pending invitations and inbound join requests · refreshes when you return to
            this tab
          </CardDescription>
          <div
            className="mt-4 flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
            role="tablist"
            aria-label="Access request views"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'invitations'}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                activeTab === 'invitations'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('invitations')}
            >
              Pending invitations
              {invitations.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {invitations.length}
                </Badge>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'join-requests'}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                activeTab === 'join-requests'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('join-requests')}
            >
              Join requests
              {joinRequests.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {joinRequests.length}
                </Badge>
              )}
            </button>
          </div>
        </CardHeader>

        {tabError && (
          <CardContent className="pb-0">
            <Alert variant="destructive">
              <AlertDescription>
                {tabError instanceof ApiError
                  ? tabError.message
                  : 'Failed to load access requests'}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}

        <CardContent className="px-0 pb-0 pt-4">
          {activeTab === 'invitations' ? (
            <TableShell>
              {invitationsQuery.isLoading ? (
                <TableSkeleton />
              ) : (
                <Table>
                  <TableHead>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Sent</TableHeaderCell>
                    <TableHeaderCell>Expires</TableHeaderCell>
                    <TableHeaderCell className="w-24">Actions</TableHeaderCell>
                  </TableHead>
                  <TableBody>
                    {invitations.length > 0 ? (
                      invitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {formatRoleLabel(invitation.role)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {formatDateTime(invitation.createdAt)}
                          </TableCell>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {formatDateTime(invitation.expiresAt)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={
                                revokeMutation.isPending &&
                                revokeMutation.variables === invitation.id
                              }
                              onClick={() => revokeMutation.mutate(invitation.id)}
                            >
                              Revoke
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyState message="No pending invitations." />
                    )}
                  </TableBody>
                </Table>
              )}
            </TableShell>
          ) : (
            <TableShell>
              {joinRequestsQuery.isLoading ? (
                <TableSkeleton />
              ) : (
                <Table>
                  <TableHead>
                    <TableHeaderCell>Email</TableHeaderCell>
                    <TableHeaderCell>Submitted</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className="w-40">Actions</TableHeaderCell>
                  </TableHead>
                  <TableBody>
                    {joinRequests.length > 0 ? (
                      joinRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">{request.email}</TableCell>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {formatDateTime(request.createdAt)}
                          </TableCell>
                          <TableCell>
                            <JoinRequestStatusBadge status={request.status} />
                          </TableCell>
                          <TableCell>
                            {request.status === 'PENDING' ? (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={actionPending}
                                  onClick={() =>
                                    setPendingAction({ type: 'approve', request })
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={actionPending}
                                  onClick={() => setPendingAction({ type: 'deny', request })}
                                >
                                  Deny
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableEmptyState message="No pending join requests." />
                    )}
                  </TableBody>
                </Table>
              )}
            </TableShell>
          )}
        </CardContent>
      </Card>

      {modalCopy && (
        <ActionConfirmModal
          open={Boolean(pendingAction)}
          title={modalCopy.title}
          description={modalCopy.description}
          confirmLabel={modalCopy.confirmLabel}
          confirmVariant={modalCopy.confirmVariant}
          isSubmitting={actionPending}
          onClose={() => {
            if (!actionPending) setPendingAction(null);
          }}
          onConfirm={handleConfirmAction}
        />
      )}
    </>
  );
}
