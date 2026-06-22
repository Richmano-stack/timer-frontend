'use client';

import { Check, Copy, Mail, UserPlus, X } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  OrganizationRole,
  ROLE_LABELS,
} from '@/lib/organization/roles';

export function buildOnboardingBlurb(organizationName: string): string {
  const workspace = organizationName.trim() || 'your organization';
  return `Welcome to ${workspace} on OmniShift!

How to get access:
1. Your IT administrator will send an invitation to your work email address.
2. Open the email and click the invitation link (valid for 7 days).
3. Sign in with that same work email — we'll send a magic link; no password is required.

If you have not received an invite, contact your team administrator. Access is invitation-only; do not share or use public self-join links.`;
}

function CopyBlurbButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <Check data-icon="inline-start" />
          Copied
        </>
      ) : (
        <>
          <Copy data-icon="inline-start" />
          Copy for Slack or wiki
        </>
      )}
    </Button>
  );
}

const ONBOARDING_STEPS = [
  {
    title: 'Send an email invitation',
    description: 'Enter each employee’s work email and role, or upload a CSV for bulk invites.',
  },
  {
    title: 'Employee opens the invite link',
    description: 'They receive a unique link in their inbox — one invite per person.',
  },
  {
    title: 'Magic-link sign-in',
    description: 'They confirm with their work email; OmniShift signs them in without a password.',
  },
] as const;

export function InviteDiscoveryPanel({
  organizationName,
  onOpenInvite,
}: {
  organizationName: string | null;
  onOpenInvite: () => void;
}) {
  const blurb = buildOnboardingBlurb(organizationName ?? 'your organization');

  return (
    <section
      aria-labelledby="invite-discovery-heading"
      className="rounded-xl border border-primary/25 bg-primary/5 p-6 shadow-sm"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-5">
          <div>
            <Badge variant="secondary" className="mb-3">
              IT lead guide
            </Badge>
            <h2
              id="invite-discovery-heading"
              className="text-xl font-semibold tracking-tight text-foreground"
            >
              Invite employees
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Onboard your team with email invitations — not public join links. Each employee
              receives a personal invite; they click through to magic-link sign-in.
            </p>
          </div>

          <ol className="grid gap-3 sm:grid-cols-3">
            {ONBOARDING_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-lg border border-border/80 bg-card/80 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <Button type="button" size="lg" onClick={onOpenInvite}>
            <UserPlus data-icon="inline-start" />
            Invite employees
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3 border-t border-border/60 pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Employee onboarding blurb</p>
            <p className="text-xs text-muted-foreground">
              Paste into Slack, email, or your internal wiki so employees know what to expect.
            </p>
          </div>
          <CopyBlurbButton text={blurb} />
        </div>
        <pre className="max-h-40 overflow-y-auto rounded-lg border border-border bg-card p-4 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {blurb}
        </pre>
      </div>
    </section>
  );
}

export function InviteModal({
  open,
  onClose,
  assignableRoles,
  defaultRole,
  atSeatLimit,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  assignableRoles: OrganizationRole[];
  defaultRole: OrganizationRole;
  atSeatLimit: boolean;
  isSubmitting: boolean;
  onSubmit: (payload: { email: string; role: OrganizationRole }) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationRole>(defaultRole);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    setEmail('');
    setRole(defaultRole);
    onClose();
  }, [isSubmitting, defaultRole, onClose]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) handleClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, isSubmitting, handleClose]);

  if (!open) return null;

  const roles = assignableRoles.length > 0 ? assignableRoles : (['member'] as OrganizationRole[]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    onSubmit({ email: normalized, role });
  };

  const scrollToBulk = () => {
    handleClose();
    window.requestAnimationFrame(() => {
      document.getElementById('bulk-invite')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-label="Close invite dialog"
        disabled={isSubmitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="invite-modal-title" className="text-lg font-semibold text-foreground">
              Send invitation
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We email a unique link to the employee. Invites expire after 7 days.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="modal-invite-email">Work email</Label>
            <Input
              id="modal-invite-email"
              type="email"
              placeholder="agent@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting || atSeatLimit}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as OrganizationRole)}
              disabled={isSubmitting || atSeatLimit}
            >
              <SelectTrigger id="modal-invite-role" aria-label="Invitation role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {atSeatLimit && (
            <p className="text-xs text-destructive">
              Seat limit reached. Revoke a pending invitation before sending more.
            </p>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="link"
              className="h-auto justify-start px-0 text-muted-foreground"
              onClick={scrollToBulk}
            >
              Inviting many people? Use bulk CSV upload
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || atSeatLimit || !email.trim()}
            >
              <Mail data-icon="inline-start" />
              {isSubmitting ? 'Sending…' : 'Send invite'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
