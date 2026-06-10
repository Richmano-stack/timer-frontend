'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
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

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

interface OrgMember {
  id: string;
  role: string;
  createdAt: Date | string;
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
  joinUrl: string;
}

type ToastState = {
  message: string;
  variant: 'error' | 'success';
};

function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString();
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

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function CopyJoinLinkButton({ joinUrl }: { joinUrl: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" variant="outline" onClick={handleCopy}>
      {copied ? (
        <>
          <Check data-icon="inline-start" />
          Copied
        </>
      ) : (
        <>
          <Copy data-icon="inline-start" />
          Copy link
        </>
      )}
    </Button>
  );
}

export function TeamInviteDashboard() {
  const [organization, setOrganization] = useState<TeamResponse | null>(null);
  const [joinSettings, setJoinSettings] = useState<JoinSettings | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDomains, setIsSavingDomains] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [team, settings] = await Promise.all([
      api.get<TeamResponse>('/api/organization/team'),
      api.get<JoinSettings>('/api/organization/join-settings'),
    ]);

    setOrganization(team);
    setActorRole(team.actorRole);
    setJoinSettings(settings);
    setAllowedDomains(settings.allowedDomains);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        await loadData();
      } catch (err) {
        if (!cancelled) {
          setToast({
            message: err instanceof ApiError ? err.message : 'Failed to load team settings',
            variant: 'error',
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const handleAddDomain = (event: FormEvent) => {
    event.preventDefault();
    setDomainError(null);

    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      setDomainError('Enter a valid domain, e.g. acme.com');
      return;
    }

    if (allowedDomains.includes(normalized)) {
      setDomainError('That domain is already allowed.');
      return;
    }

    setAllowedDomains((current) => [...current, normalized]);
    setDomainInput('');
  };

  const handleRemoveDomain = (domain: string) => {
    setAllowedDomains((current) => current.filter((item) => item !== domain));
  };

  const handleRoleChange = async (memberId: string, role: OrganizationRole) => {
    setUpdatingMemberId(memberId);

    try {
      await api.patch<{ memberId: string; role: string }>(
        `/api/organization/members/${memberId}/role`,
        { role }
      );

      setToast({ message: `Role updated to ${ROLE_LABELS[role]}.`, variant: 'success' });
      await loadData();
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to update role',
        variant: 'error',
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleSaveDomains = async () => {
    setDomainError(null);
    setIsSavingDomains(true);

    try {
      const updated = await api.patch<JoinSettings>('/api/organization/join-settings', {
        allowedDomains,
      });
      setJoinSettings(updated);
      setAllowedDomains(updated.allowedDomains);
      setToast({ message: 'Allowed domains updated.', variant: 'success' });
    } catch (err) {
      setDomainError(err instanceof ApiError ? err.message : 'Failed to save domains.');
    } finally {
      setIsSavingDomains(false);
    }
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
              ? `Manage who can join ${organization.name} and assign roles`
              : 'Manage team access and roles'}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Join link</CardTitle>
              <CardDescription>
                Employees verify their work email via magic link before joining as agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : joinSettings ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Share this link in Slack, email, or your internal wiki. New hires enter their
                    work email, receive a magic link, and join automatically.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <code className="min-w-0 flex-1 break-all rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs">
                      {joinSettings.joinUrl}
                    </code>
                    <CopyJoinLinkButton joinUrl={joinSettings.joinUrl} />
                  </div>
                  {process.env.NODE_ENV === 'development' && (
                    <p className="text-xs text-muted-foreground">
                      Dev mode: magic links are logged in the server console.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Join settings are unavailable.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allowed email domains</CardTitle>
              <CardDescription>
                Only addresses from these domains can use the join link
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleAddDomain} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="domain-input">Add domain</Label>
                  <Input
                    id="domain-input"
                    type="text"
                    placeholder="acme.com"
                    value={domainInput}
                    onChange={(event) => setDomainInput(event.target.value)}
                    disabled={isSavingDomains}
                  />
                </div>
                <Button type="submit" variant="secondary" disabled={isSavingDomains}>
                  Add domain
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {allowedDomains.length > 0 ? (
                  allowedDomains.map((domain) => (
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
                    No domains configured. Joining is blocked until at least one domain is added.
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
                  disabled={isSavingDomains || allowedDomains.length === 0}
                >
                  {isSavingDomains ? 'Saving…' : 'Save allowed domains'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team members</CardTitle>
              <CardDescription>
                {organization?.members.length ?? 0} in organization · owners and admins can change
                agent/admin roles
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <TableShell>
                {isLoading ? (
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
                                  isUpdating={updatingMemberId === member.id}
                                  onRoleChange={handleRoleChange}
                                />
                              ) : (
                                <Badge variant="secondary">{formatRoleLabel(member.role)}</Badge>
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
