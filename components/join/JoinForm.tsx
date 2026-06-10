'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthBrand } from '@/components/auth-brand';
import { api, ApiError } from '@/lib/api';
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

interface JoinFormProps extends React.ComponentProps<'div'> {
  orgSlug: string;
  orgName: string;
  allowedDomains: string[];
  initialError?: string | null;
}

export function JoinForm({
  className,
  orgSlug,
  orgName,
  allowedDomains,
  initialError,
  ...props
}: JoinFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const result = await api.post<{ message: string; organizationName: string }>(
        '/api/join/request-magic-link',
        {
          email: email.trim(),
          orgSlug,
        }
      );

      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send magic link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthBrand />
      <Card>
        <CardHeader>
          <CardTitle>Join {orgName}</CardTitle>
          <CardDescription>
            Enter your work email to receive a secure sign-in link. Only approved company
            domains can join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="organization">Organization</FieldLabel>
                <Input id="organization" type="text" value={orgName} readOnly disabled />
              </Field>
              {allowedDomains.length > 0 && (
                <Field>
                  <FieldDescription>
                    Allowed domains: {allowedDomains.map((domain) => `@${domain}`).join(', ')}
                  </FieldDescription>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="email">Work Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
              {error && (
                <Field>
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                </Field>
              )}
              {success && (
                <Field>
                  <p className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 px-3 py-2 text-sm text-foreground">
                    {success}
                    {process.env.NODE_ENV === 'development' && (
                      <span className="mt-2 block text-xs text-muted-foreground">
                        Dev mode: check the server console for the magic link URL.
                      </span>
                    )}
                  </p>
                </Field>
              )}
              <Field>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending link…' : 'Email me a sign-in link'}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{' '}
                  <Link href="/login" className="underline-offset-4 hover:underline">
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
