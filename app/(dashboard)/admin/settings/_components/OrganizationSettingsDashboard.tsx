'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Palette, X } from 'lucide-react';
import {
  formatTimezoneLabel,
  getBrowserTimezone,
  getIanaTimezones,
} from '@/app/(auth)/onboarding/_components/timezone-options';
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
import { Toast, ToastStack } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { normalizeDomain } from '@/lib/organization/metadata';
import { cn } from '@/lib/utils';
import { organizationKeys } from './query-keys';

interface OrganizationSettings {
  organizationId: string;
  name: string;
  slug: string;
  timezone: string | null;
  allowedDomains: string[];
  requireApproval: boolean;
}

interface JoinSettingsPatchResponse {
  allowedDomains: string[];
  requireApproval: boolean;
}

type ToastState = {
  message: string;
  variant: 'error' | 'success';
};

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-40 w-full" />
      ))}
    </div>
  );
}

function JoinPolicyToggle({
  enabled,
  disabled,
  onChange,
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        enabled ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-sm ring-0 transition-transform',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}

export function OrganizationSettingsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timezones = useMemo(() => getIanaTimezones(), []);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const [timezoneInput, setTimezoneInput] = useState(() => getBrowserTimezone());
  const [timezoneDirty, setTimezoneDirty] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainsDirty, setDomainsDirty] = useState(false);

  const settingsQuery = useQuery({
    queryKey: organizationKeys.settings(),
    queryFn: () => api.get<OrganizationSettings>('/api/organization/settings'),
  });

  const settings = settingsQuery.data ?? null;

  const resolvedTimezone =
    settings?.timezone && timezones.includes(settings.timezone)
      ? settings.timezone
      : timezones.includes(getBrowserTimezone())
        ? getBrowserTimezone()
        : 'UTC';

  const nameValue = nameDirty ? nameInput : (settings?.name ?? '');
  const timezoneValue = timezoneDirty ? timezoneInput : resolvedTimezone;

  const invalidateSettings = () => {
    void queryClient.invalidateQueries({ queryKey: organizationKeys.settings() });
  };

  const nameMutation = useMutation({
    mutationFn: (name: string) =>
      api.patch<OrganizationSettings>('/api/organization/settings', { name }),
    onSuccess: (updated) => {
      setNameInput(updated.name);
      setNameDirty(false);
      setToast({ message: 'Organization name updated.', variant: 'success' });
      invalidateSettings();
      router.refresh();
    },
    onError: (err) => {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to update organization name.',
        variant: 'error',
      });
    },
  });

  const timezoneMutation = useMutation({
    mutationFn: (timezone: string) =>
      api.patch<OrganizationSettings>('/api/organization/settings', { timezone }),
    onSuccess: (updated) => {
      if (updated.timezone) {
        setTimezoneInput(updated.timezone);
      }
      setTimezoneDirty(false);
      setToast({ message: 'Timezone updated.', variant: 'success' });
      invalidateSettings();
    },
    onError: (err) => {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to update timezone.',
        variant: 'error',
      });
    },
  });

  const domainsMutation = useMutation({
    mutationFn: (domains: string[]) =>
      api.patch<JoinSettingsPatchResponse>('/api/organization/join-settings', {
        allowedDomains: domains,
      }),
    onSuccess: (updated) => {
      setAllowedDomains(updated.allowedDomains);
      setDomainsDirty(false);
      setToast({ message: 'Allowed domains updated.', variant: 'success' });
      invalidateSettings();
    },
    onError: (err) => {
      setDomainError(err instanceof ApiError ? err.message : 'Failed to save domains.');
    },
  });

  const joinPolicyMutation = useMutation({
    mutationFn: (requireApproval: boolean) =>
      api.patch<JoinSettingsPatchResponse>('/api/organization/join-settings', {
        requireApproval,
      }),
    onSuccess: () => {
      setToast({
        message: 'Join policy updated.',
        variant: 'success',
      });
      invalidateSettings();
    },
    onError: (err) => {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to update join policy.',
        variant: 'error',
      });
    },
  });

  const displayedDomains = domainsDirty
    ? allowedDomains
    : (settings?.allowedDomains ?? allowedDomains);

  const handleSaveName = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setToast({ message: 'Organization name is required.', variant: 'error' });
      return;
    }
    nameMutation.mutate(trimmed);
  };

  const handleSaveTimezone = () => {
    timezoneMutation.mutate(timezoneValue);
  };

  const handleAddDomain = (event: FormEvent) => {
    event.preventDefault();
    setDomainError(null);

    const normalized = normalizeDomain(domainInput);
    if (!normalized || !normalized.includes('.')) {
      setDomainError('Enter a valid domain, e.g. acme.com');
      return;
    }

    const base = domainsDirty ? allowedDomains : (settings?.allowedDomains ?? []);
    if (base.includes(normalized)) {
      setDomainError('That domain is already allowed.');
      return;
    }

    setAllowedDomains([...base, normalized]);
    setDomainsDirty(true);
    setDomainInput('');
  };

  const handleRemoveDomain = (domain: string) => {
    const base = domainsDirty ? allowedDomains : (settings?.allowedDomains ?? []);
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

  const loadError = settingsQuery.error;

  return (
    <>
      <div className="h-full min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Organization
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Settings</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Workspace display name, timezone, and employee join policies
            </p>
          </div>

          {loadError && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>
                {loadError instanceof ApiError
                  ? loadError.message
                  : 'Failed to load organization settings'}
              </AlertDescription>
            </Alert>
          )}

          {settingsQuery.isLoading ? (
            <SettingsSkeleton />
          ) : (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Display name</CardTitle>
                  <CardDescription>
                    Shown in the admin sidebar and employee-facing join pages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveName} className="flex flex-col gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization name</Label>
                      <Input
                        id="org-name"
                        value={nameValue}
                        onChange={(event) => {
                          setNameInput(event.target.value);
                          setNameDirty(true);
                        }}
                        placeholder="Acme Call Center"
                        maxLength={120}
                        disabled={nameMutation.isPending}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={!nameDirty || nameMutation.isPending}
                      >
                        {nameMutation.isPending ? 'Saving…' : 'Save name'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Operational timezone</CardTitle>
                  <CardDescription>
                    Primary timezone for shift boundaries and reporting. All timestamps are stored in
                    UTC.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={timezones.includes(timezoneValue) ? timezoneValue : 'UTC'}
                      onValueChange={(value) => {
                        setTimezoneInput(value);
                        setTimezoneDirty(true);
                      }}
                      disabled={timezoneMutation.isPending}
                    >
                      <SelectTrigger id="timezone" className="w-full">
                        <SelectValue placeholder="Select a timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {timezones.map((zone) => (
                          <SelectItem key={zone} value={zone}>
                            {formatTimezoneLabel(zone)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveTimezone}
                      disabled={!timezoneDirty || timezoneMutation.isPending}
                    >
                      {timezoneMutation.isPending ? 'Saving…' : 'Save timezone'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Allowed email domains</CardTitle>
                  <CardDescription>
                    Employees can self-serve join only with work emails from these domains
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <form onSubmit={handleAddDomain} className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="domain-input" className="sr-only">
                        Domain
                      </Label>
                      <Input
                        id="domain-input"
                        value={domainInput}
                        onChange={(event) => setDomainInput(event.target.value)}
                        placeholder="acme.com"
                        disabled={domainsMutation.isPending}
                      />
                    </div>
                    <Button type="submit" variant="outline" disabled={domainsMutation.isPending}>
                      Add domain
                    </Button>
                  </form>

                  {domainError && (
                    <Alert variant="destructive">
                      <AlertDescription>{domainError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {displayedDomains.length > 0 ? (
                      displayedDomains.map((domain) => (
                        <Badge key={domain} variant="secondary" className="gap-1 pr-1">
                          {domain}
                          <button
                            type="button"
                            className="rounded-sm p-0.5 hover:bg-muted"
                            aria-label={`Remove ${domain}`}
                            onClick={() => handleRemoveDomain(domain)}
                            disabled={domainsMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No domains configured yet.</p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveDomains}
                      disabled={!domainsDirty || domainsMutation.isPending}
                    >
                      {domainsMutation.isPending ? 'Saving…' : 'Save domains'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Compliance</CardTitle>
                  <CardDescription>
                    Review security-sensitive changes recorded in your workspace audit log
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild>
                    <Link href="/admin/settings/audit">View audit trail</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity statuses</CardTitle>
                  <CardDescription>
                    Customize trackable employee states, display colors, and billable flags
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild>
                    <Link href="/admin/settings/statuses">
                      <Palette data-icon="inline-start" />
                      Manage activity statuses
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Join policy</CardTitle>
                  <CardDescription>
                    Control whether self-serve join requests need admin approval before membership is
                    granted
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Require admin approval</p>
                      <p className="text-xs text-muted-foreground">
                        When enabled, employees who join via your public link are queued for review
                        instead of joining immediately.
                      </p>
                    </div>
                    <JoinPolicyToggle
                      enabled={settings?.requireApproval ?? false}
                      disabled={joinPolicyMutation.isPending || settingsQuery.isFetching}
                      onChange={(value) => joinPolicyMutation.mutate(value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

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
