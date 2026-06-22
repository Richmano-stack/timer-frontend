'use client';

import { FormEvent } from 'react';
import { X } from 'lucide-react';
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface AllowedDomainsStepProps {
  allowedDomains: string[];
  domainInput: string;
  domainError: string | null;
  isSubmitting: boolean;
  submitError: string | null;
  onDomainInputChange: (value: string) => void;
  onAddDomain: (event: FormEvent) => void;
  onRemoveDomain: (domain: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function AllowedDomainsStep({
  allowedDomains,
  domainInput,
  domainError,
  isSubmitting,
  submitError,
  onDomainInputChange,
  onAddDomain,
  onRemoveDomain,
  onBack,
  onSubmit,
}: AllowedDomainsStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Allowed email domains</CardTitle>
        <CardDescription>
          Seed the domains employees may use to request access. You can change these later in
          workspace settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="domain-input">Add domain</FieldLabel>
            <form onSubmit={onAddDomain} className="flex gap-2">
              <Input
                id="domain-input"
                type="text"
                placeholder="acme.com"
                autoComplete="off"
                value={domainInput}
                onChange={(event) => onDomainInputChange(event.target.value)}
                disabled={isSubmitting}
              />
              <Button type="submit" variant="secondary" disabled={isSubmitting}>
                Add
              </Button>
            </form>
            <FieldDescription>
              Only email addresses from these domains can use your company join link.
            </FieldDescription>
          </Field>
          <Field>
            <div className="flex flex-wrap gap-2">
              {allowedDomains.length > 0 ? (
                allowedDomains.map((domain) => (
                  <Badge key={domain} variant="outline" className="gap-1 pr-1">
                    @{domain}
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted"
                      onClick={() => onRemoveDomain(domain)}
                      disabled={isSubmitting}
                      aria-label={`Remove ${domain}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add at least one domain to enable employee self-join.
                </p>
              )}
            </div>
          </Field>
          {domainError && (
            <Field>
              <Alert variant="destructive">
                <AlertDescription>{domainError}</AlertDescription>
              </Alert>
            </Field>
          )}
          {submitError && (
            <Field>
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </p>
            </Field>
          )}
          <Field className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onBack}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={onSubmit}
              disabled={isSubmitting || allowedDomains.length === 0}
            >
              {isSubmitting ? 'Creating workspace…' : 'Create workspace'}
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
