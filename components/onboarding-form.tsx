'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthBrand } from '@/components/auth-brand';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { slugifyOrganizationName } from '@/lib/utils/org-slug';
import { cn } from '@/lib/utils';
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

export function OnboardingForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const name = companyName.trim();
    if (!name) {
      setError('Company name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const slug = slugifyOrganizationName(name);
      const orgResult = await authClient.organization.create({
        name,
        slug,
      });

      if (orgResult.error) {
        setError(orgResult.error.message ?? 'Failed to create organization.');
        return;
      }

      const organizationId = orgResult.data?.id;
      if (!organizationId) {
        setError('Organization was created but no ID was returned.');
        return;
      }

      const activeResult = await authClient.organization.setActive({
        organizationId,
      });

      if (activeResult.error) {
        setError(activeResult.error.message ?? 'Failed to set active organization.');
        return;
      }

      await api.post<{ seeded: number }>('/api/organization/bootstrap');

      router.replace('/admin/overview');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthBrand />
      <Card>
        <CardHeader>
          <CardTitle>Set up your company</CardTitle>
          <CardDescription>
            Create your workspace to start tracking time with your team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="company-name">Company Name</FieldLabel>
                <Input
                  id="company-name"
                  type="text"
                  placeholder="Acme Inc"
                  autoComplete="organization"
                  required
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  disabled={isSubmitting}
                />
                <FieldDescription>
                  This becomes your organization workspace. You will be assigned the
                  owner role automatically.
                </FieldDescription>
              </Field>
              {error && (
                <Field>
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                </Field>
              )}
              <Field>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating workspace…' : 'Continue'}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
