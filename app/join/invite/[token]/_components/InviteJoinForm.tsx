'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { AuthBrand } from '@/components/auth-brand';
import { api, ApiError } from '@/lib/api';
import {
  buildInviteOAuthCallbackURL,
  buildInviteOAuthErrorCallbackURL,
} from '@/lib/auth/oauth-callback-url';
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
import { Separator } from '@/components/ui/separator';

interface InviteJoinFormProps extends React.ComponentProps<'div'> {
  token: string;
  orgName: string;
  maskedEmail: string;
  initialError?: string | null;
}

export function InviteJoinForm({
  className,
  token,
  orgName,
  maskedEmail,
  initialError,
  ...props
}: InviteJoinFormProps) {
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
        `/api/join/invite/${token}/request-magic-link`,
        {
          email: email.trim(),
        }
      );

      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send magic link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const oauthCallbackURL = buildInviteOAuthCallbackURL(token);
  const oauthErrorCallbackURL = buildInviteOAuthErrorCallbackURL(token);

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthBrand />
      <Card>
        <CardHeader>
          <CardTitle>Join {orgName}</CardTitle>
          <CardDescription>
            You were invited as {maskedEmail}. Continue with Google or confirm your email
            for a secure sign-in link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <GoogleSignInButton
              callbackURL={oauthCallbackURL}
              errorCallbackURL={oauthErrorCallbackURL}
              disabled={isSubmitting || Boolean(success)}
              onError={setError}
              requestSignUp
            />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or use email</span>
              </div>
            </div>
          </FieldGroup>
          <form onSubmit={handleSubmit} className="mt-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="organization">Organization</FieldLabel>
                <Input id="organization" type="text" value={orgName} readOnly disabled />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Invited email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder={maskedEmail}
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                />
                <FieldDescription>
                  Enter the same address this invitation was sent to ({maskedEmail}).
                </FieldDescription>
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
