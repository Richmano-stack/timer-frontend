'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { canEditMemberStatus, primaryRole } from '@/lib/organization/roles';
import { organizationKeys } from './query-keys';

export type MemberStatus = 'ACTIVE' | 'DEACTIVATED';

type PendingAction = 'suspend' | 'reactivate' | null;

function MemberStatusBadge({ status }: { status: MemberStatus }) {
  if (status === 'ACTIVE') {
    return <Badge variant="default">Active</Badge>;
  }
  return <Badge variant="destructive">Deactivated</Badge>;
}

function StatusConfirmModal({
  open,
  action,
  memberName,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  action: 'suspend' | 'reactivate';
  memberName: string;
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

  const isSuspend = action === 'suspend';

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
        aria-labelledby="member-status-confirm-title"
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h3 id="member-status-confirm-title" className="text-lg font-semibold text-foreground">
          {isSuspend ? 'Suspend member?' : 'Reactivate member?'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {isSuspend
            ? `${memberName} will be deactivated and blocked from clock-in and other time-tracking actions on their next request.`
            : `${memberName} will regain access and can clock in again.`}
        </p>
        {isSuspend && (
          <Alert className="mt-4">
            <AlertDescription className="text-xs">
              Active sessions are not revoked immediately; the member is blocked when they next
              call a protected API. Full session invalidation may follow in a later release.
            </AlertDescription>
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
            variant={isSuspend ? 'destructive' : 'default'}
            className="flex-1"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Processing…' : isSuspend ? 'Suspend' : 'Reactivate'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MemberRowActions({
  memberId,
  memberName,
  memberRole,
  memberStatus,
  memberUserId,
  actorRole,
  actorUserId,
  activeOwnerCount,
  onToast,
}: {
  memberId: string;
  memberName: string;
  memberRole: string;
  memberStatus: MemberStatus;
  memberUserId: string;
  actorRole: string;
  actorUserId: string | null;
  activeOwnerCount: number;
  onToast: (toast: { message: string; variant: 'error' | 'success' }) => void;
}) {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const statusMutation = useMutation({
    mutationFn: (status: MemberStatus) =>
      api.patch<{ memberId: string; status: MemberStatus }>(
        `/api/organization/members/${memberId}/status`,
        { status }
      ),
    onSuccess: (_data, status) => {
      setPendingAction(null);
      onToast({
        message:
          status === 'DEACTIVATED'
            ? `${memberName} has been suspended.`
            : `${memberName} has been reactivated.`,
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.team() });
    },
    onError: (err) => {
      onToast({
        message: err instanceof ApiError ? err.message : 'Failed to update member status',
        variant: 'error',
      });
    },
  });

  const canEdit = canEditMemberStatus(actorRole, memberRole);
  const isSelf = actorUserId !== null && memberUserId === actorUserId;
  const isActiveOwner =
    primaryRole(memberRole) === 'owner' && memberStatus === 'ACTIVE';
  const isLastOwner = isActiveOwner && activeOwnerCount <= 1;

  const canSuspend =
    canEdit && !isSelf && !isLastOwner && memberStatus === 'ACTIVE';
  const canReactivate = canEdit && memberStatus === 'DEACTIVATED';

  const handleConfirm = () => {
    if (!pendingAction) return;
    statusMutation.mutate(pendingAction === 'suspend' ? 'DEACTIVATED' : 'ACTIVE');
  };

  if (!canEdit) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <>
      <div className="flex gap-1">
        {memberStatus === 'ACTIVE' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canSuspend || statusMutation.isPending}
            title={
              isSelf
                ? 'You cannot suspend your own account'
                : isLastOwner
                  ? 'Cannot suspend the last owner'
                  : undefined
            }
            onClick={() => setPendingAction('suspend')}
          >
            Suspend
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canReactivate || statusMutation.isPending}
            onClick={() => setPendingAction('reactivate')}
          >
            Reactivate
          </Button>
        )}
      </div>

      {pendingAction && (
        <StatusConfirmModal
          open={Boolean(pendingAction)}
          action={pendingAction}
          memberName={memberName}
          isSubmitting={statusMutation.isPending}
          onClose={() => {
            if (!statusMutation.isPending) setPendingAction(null);
          }}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

export { MemberStatusBadge };
