'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
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
import { Toast, ToastStack } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { normalizeDomain } from '@/lib/organization/metadata';
import {
  assignableRolesForActor,
  canEditMemberRole,
  formatRoleLabel,
  OrganizationRole,
  primaryRole,
  ROLE_LABELS,
} from '@/lib/organization/roles';
import { InviteDiscoveryPanel, InviteModal } from './InviteModal';
import { parseCsvInvites } from './parse-csv-invites';
import { organizationKeys, SEAT_LIMIT_PLACEHOLDER } from './query-keys';
import { RequestsTable } from './RequestsTable';

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

interface OrgMember {
  id: string;
  role: string;
  createdAt: string;
  user: OrgUser;
}

interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  actorRole: string;
  members: OrgMember[];
}

interface JoinSettings {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  allowedDomains: string[];
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

type ToastState = {
  message: string;
  variant: 'error' | 'success';
};

interface BulkProgress {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  currentEmail: string | null;
}

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

function MemberRoleEditor({
  memberId,
  memberRole,
  actorRole,
  isUpdating,
  onRoleChange,
}: {
  memberId: string;
  memberRole: string;
  actorRole: string;
  isUpdating: boolean;
  onRoleChange: (memberId: string, role: OrganizationRole) => void;
}) {
  const editable = canEditMemberRole(actorRole, memberRole);
  const current = primaryRole(memberRole);
  const options = assignableRolesForActor(actorRole);

  if (!editable) {
    return <Badge variant="secondary">{formatRoleLabel(memberRole)}</Badge>;
  }

  return (
    <Select
      value={current}
      onValueChange={(value) => onRoleChange(memberId, value as OrganizationRole)}
      disabled={isUpdating}
    >
      <SelectTrigger className="w-[11rem]" aria-label="Member role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SeatIndicator({
  memberCount,
  pendingCount,
  limit,
  isLoading,
}: {
  memberCount: number;
  pendingCount: number;
  limit: number;
  isLoading: boolean;
}) {
  const used = memberCount + pendingCount;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const atLimit = used >= limit;

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{used}</span> of {limit} seats in use
        </p>
        <Badge variant={atLimit ? 'destructive' : 'secondary'}>
          {memberCount} members · {pendingCount} pending
        </Badge>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label="Seat usage"
      >
        <div
          className={`h-full rounded-full transition-all ${atLimit ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {atLimit && (
        <p className="text-xs text-destructive">
          Seat limit reached. Revoke pending invitations or upgrade your plan to invite more people.
        </p>
      )}
    </div>
  );
}

export function TeamInviteDashboard() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainsDirty, setDomainsDirty] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [bulkParseErrors, setBulkParseErrors] = useState<string[]>([]);

  const teamQuery = useQuery({
    queryKey: organizationKeys.team(),
    queryFn: () => api.get<TeamResponse>('/api/organization/team'),
  });

  const invitationsQuery = useQuery({
    queryKey: organizationKeys.invitations(),
    queryFn: () => api.get<Invitation[]>('/api/organization/invitations'),
    refetchOnWindowFocus: true,
  });

  const joinSettingsQuery = useQuery({
    queryKey: organizationKeys.joinSettings(),
    queryFn: () => api.get<JoinSettings>('/api/organization/join-settings'),
  });

  const actorRole = teamQuery.data?.actorRole ?? null;
  const assignableRoles = actorRole ? assignableRolesForActor(actorRole) : [];
  const defaultInviteRole = assignableRoles[0] ?? 'member';

  const invalidateTeamAndInvites = () => {
    void queryClient.invalidateQueries({ queryKey: organizationKeys.team() });
    void queryClient.invalidateQueries({ queryKey: organizationKeys.invitations() });
    void queryClient.invalidateQueries({ queryKey: organizationKeys.joinRequests() });
  };

  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; role: OrganizationRole }) =>
      api.post<Invitation>('/api/organization/invitations', payload),
    onSuccess: () => {
      setInviteModalOpen(false);
      setToast({ message: 'Invitation sent.', variant: 'success' });
      invalidateTeamAndInvites();
    },
    onError: (err) => {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to send invitation',
        variant: 'error',
      });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: OrganizationRole }) =>
      api.patch<{ memberId: string; role: string }>(
        `/api/organization/members/${memberId}/role`,
        { role }
      ),
    onSuccess: (_data, variables) => {
      setToast({
        message: `Role updated to ${ROLE_LABELS[variables.role]}.`,
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.team() });
    },
    onError: (err) => {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to update role',
        variant: 'error',
      });
    },
  });

  const domainsMutation = useMutation({
    mutationFn: (domains: string[]) =>
      api.patch<JoinSettings>('/api/organization/join-settings', {
        allowedDomains: domains,
      }),
    onSuccess: (updated) => {
      setAllowedDomains(updated.allowedDomains);
      setDomainsDirty(false);
      setToast({ message: 'Allowed domains updated.', variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: organizationKeys.joinSettings() });
    },
    onError: (err) => {
      setDomainError(err instanceof ApiError ? err.message : 'Failed to save domains.');
    },
  });

  const isLoading =
    teamQuery.isLoading || invitationsQuery.isLoading || joinSettingsQuery.isLoading;

  const loadError =
    teamQuery.error ?? invitationsQuery.error ?? joinSettingsQuery.error ?? null;

  const organization = teamQuery.data ?? null;
  const invitations = invitationsQuery.data ?? [];
  const joinSettings = joinSettingsQuery.data ?? null;

  const displayedDomains = domainsDirty
    ? allowedDomains
    : (joinSettings?.allowedDomains ?? allowedDomains);

  const memberCount = organization?.members.length ?? 0;
  const pendingCount = invitations.length;
  const seatsUsed = memberCount + pendingCount;
  const atSeatLimit = seatsUsed >= SEAT_LIMIT_PLACEHOLDER;

  const handleBulkFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBulkParseErrors([]);
    const text = await file.text();
    const { rows, errors } = parseCsvInvites(text);

    if (errors.length > 0) {
      setBulkParseErrors(errors);
      return;
    }

    if (rows.length === 0) {
      setBulkParseErrors(['No valid rows found in the file.']);
      return;
    }

    if (seatsUsed + rows.length > SEAT_LIMIT_PLACEHOLDER) {
      setBulkParseErrors([
        `Upload would exceed the ${SEAT_LIMIT_PLACEHOLDER}-seat limit. Remove ${seatsUsed + rows.length - SEAT_LIMIT_PLACEHOLDER} row(s) or revoke pending invitations.`,
      ]);
      return;
    }

    setBulkProgress({
      total: rows.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      currentEmail: null,
    });

    let succeeded = 0;
    let failed = 0;

    for (const row of rows) {
      setBulkProgress((current) =>
        current ? { ...current, currentEmail: row.email } : current
      );

      try {
        await api.post<Invitation>('/api/organization/invitations', row);
        succeeded += 1;
      } catch {
        failed += 1;
      }

      setBulkProgress((current) =>
        current
          ? {
              ...current,
              completed: current.completed + 1,
              succeeded,
              failed,
            }
          : current
      );
    }

    invalidateTeamAndInvites();

    setToast({
      message:
        failed === 0
          ? `${succeeded} invitation${succeeded === 1 ? '' : 's'} sent.`
          : `${succeeded} sent, ${failed} failed.`,
      variant: failed === 0 ? 'success' : 'error',
    });

    setBulkProgress(null);
  };

  const handleAddDomain = (event: FormEvent) => {
    event.preventDefault();
    setDomainError(null);

    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setDomainError('Enter a valid domain, e.g. acme.com');
      return;
    }

    const base = domainsDirty ? allowedDomains : (joinSettings?.allowedDomains ?? []);
    if (base.includes(normalized)) {
      setDomainError('That domain is already allowed.');
      return;
    }

    setAllowedDomains([...base, normalized]);
    setDomainsDirty(true);
    setDomainInput('');
  };

  const handleRemoveDomain = (domain: string) => {
    const base = domainsDirty ? allowedDomains : (joinSettings?.allowedDomains ?? []);
    setAllowedDomains(base.filter((item) => item !== domain));
    setDomainsDirty(true);
  };

  const handleSaveDomains = () => {
    setDomainError(null);
    if (displayedDomains.length === 0) {
      setDomainError('Add at least one allowed domain.');
      return;
    }
    domainsMutation.mutate(displayedDomains);
  };

  return (
    <>
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Organization
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Team</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {organization
                ? `Invite employees to ${organization.name} and manage access`
                : 'Invite employees and manage team access'}
            </p>
          </div>

          {loadError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {loadError instanceof ApiError
                  ? loadError.message
                  : 'Failed to load team settings'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-6">
            <InviteDiscoveryPanel
              organizationName={organization?.name ?? null}
              onOpenInvite={() => setInviteModalOpen(true)}
            />

            <Card>
              <CardHeader>
                <CardTitle>Seat usage</CardTitle>
                <CardDescription>
                  Active members plus pending invitations count toward your workspace limit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SeatIndicator
                  memberCount={memberCount}
                  pendingCount={pendingCount}
                  limit={SEAT_LIMIT_PLACEHOLDER}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>

            <Card id="bulk-invite">
              <CardHeader>
                <CardTitle>Bulk invite</CardTitle>
                <CardDescription>
                  Upload a CSV to send many invitations at once. Invites expire after 7 days.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">CSV format</p>
                    <p className="text-xs text-muted-foreground">
                      One row per employee: <code className="text-xs">email,role</code> (role
                      optional, defaults to member)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,text/csv,text/plain"
                      className="sr-only"
                      onChange={handleBulkFile}
                      disabled={Boolean(bulkProgress) || atSeatLimit}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={Boolean(bulkProgress) || atSeatLimit}
                    >
                      <Upload data-icon="inline-start" />
                      Upload CSV
                    </Button>
                  </div>
                </div>

                {bulkParseErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <ul className="list-inside list-disc space-y-1">
                        {bulkParseErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {bulkProgress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Processing {bulkProgress.completed} of {bulkProgress.total}
                        {bulkProgress.currentEmail ? ` · ${bulkProgress.currentEmail}` : ''}
                      </span>
                      <span>
                        {bulkProgress.succeeded} ok · {bulkProgress.failed} failed
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.round((bulkProgress.completed / bulkProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <RequestsTable onToast={setToast} />

            <Card>
              <CardHeader>
                <CardTitle>Allowed email domains</CardTitle>
                <CardDescription>
                  Invited employees must use an address from these domains
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <form
                  onSubmit={handleAddDomain}
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="domain-input">Add domain</Label>
                    <Input
                      id="domain-input"
                      type="text"
                      placeholder="acme.com"
                      value={domainInput}
                      onChange={(event) => setDomainInput(event.target.value)}
                      disabled={domainsMutation.isPending}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={domainsMutation.isPending}
                  >
                    Add domain
                  </Button>
                </form>

                <div className="flex flex-wrap gap-2">
                  {displayedDomains.length > 0 ? (
                    displayedDomains.map((domain) => (
                      <Badge key={domain} variant="outline" className="gap-1 pr-1">
                        @{domain}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="size-5 rounded-full"
                          onClick={() => handleRemoveDomain(domain)}
                          aria-label={`Remove ${domain}`}
                        >
                          <X />
                        </Button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No domains configured. Add at least one domain before inviting employees.
                    </p>
                  )}
                </div>

                {domainError && (
                  <Alert variant="destructive">
                    <AlertDescription>{domainError}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Button
                    type="button"
                    onClick={handleSaveDomains}
                    disabled={
                      domainsMutation.isPending ||
                      displayedDomains.length === 0 ||
                      !domainsDirty
                    }
                  >
                    {domainsMutation.isPending ? 'Saving…' : 'Save allowed domains'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">Team members</CardTitle>
                <CardDescription>
                  {organization?.members.length ?? 0} in organization · owners and admins can
                  change agent/admin roles
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                <TableShell>
                  {teamQuery.isLoading ? (
                    <TableSkeleton />
                  ) : (
                    <Table>
                      <TableHead>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Email</TableHeaderCell>
                        <TableHeaderCell>Role</TableHeaderCell>
                        <TableHeaderCell>Joined</TableHeaderCell>
                      </TableHead>
                      <TableBody>
                        {organization && organization.members.length > 0 ? (
                          organization.members.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell className="font-medium">{member.user.name}</TableCell>
                              <TableCell>{member.user.email}</TableCell>
                              <TableCell>
                                {actorRole ? (
                                  <MemberRoleEditor
                                    memberId={member.id}
                                    memberRole={member.role}
                                    actorRole={actorRole}
                                    isUpdating={
                                      roleMutation.isPending &&
                                      roleMutation.variables?.memberId === member.id
                                    }
                                    onRoleChange={(memberId, role) =>
                                      roleMutation.mutate({ memberId, role })
                                    }
                                  />
                                ) : (
                                  <Badge variant="secondary">
                                    {formatRoleLabel(member.role)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs tabular-nums">
                                {formatDateTime(member.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableEmptyState message="No team members found." />
                        )}
                      </TableBody>
                    </Table>
                  )}
                </TableShell>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      <InviteModal
        key={inviteModalOpen ? 'open' : 'closed'}
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        assignableRoles={assignableRoles}
        defaultRole={defaultInviteRole}
        atSeatLimit={atSeatLimit}
        isSubmitting={inviteMutation.isPending}
        onSubmit={(payload) => inviteMutation.mutate(payload)}
      />

      {toast && (
        <ToastStack>
          <Toast
            message={toast.message}
            variant={toast.variant}
            onDismiss={() => setToast(null)}
          />
        </ToastStack>
      )}
    </>
  );
}
