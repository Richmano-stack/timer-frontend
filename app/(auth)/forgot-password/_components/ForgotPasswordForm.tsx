'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { AuthBrand } from '@/components/auth-brand';
import { authClient } from '@/lib/auth-client';
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

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : '/reset-password';

      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo,
      });

      if (result.error) {
        setError(result.error.message ?? 'Failed to send reset email.');
        return;
      }

      setSuccess(
        'If an account exists for that email, we sent a password reset link. Check your inbox.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <AuthBrand />
      <Card>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we will send you a link to choose a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting || Boolean(success)}
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
                  <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {success}
                  </p>
                </Field>
              )}
              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || Boolean(success)}
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </Button>
                <FieldDescription className="text-center">
                  <Link href="/login" className="underline-offset-4 hover:underline">
                    Back to login
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
