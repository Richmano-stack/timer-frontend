'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { AuthBrand } from '@/components/auth-brand';
import { authClient } from '@/lib/auth-client';
import { completeSignInFlow } from '@/lib/auth/complete-sign-in';
import {
  buildOAuthCallbackURL,
  buildOAuthErrorCallbackURL,
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

const IS_DEV = process.env.NODE_ENV === 'development';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');

  const [email, setEmail] = useState(IS_DEV ? 'demo@example.com' : '');
  const [password, setPassword] = useState(IS_DEV ? 'DemoPassword1!' : '');
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'oauth') {
      setError('Google sign-in failed. Please try again or use email.');
      return;
    }

    if (error === 'signup_disabled') {
      setError(
        'No account was found for this Google identity. Ask your administrator for an invitation link.'
      );
      return;
    }

    if (searchParams.get('reset') === 'success') {
      setResetSuccess(true);
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const signInResult = await authClient.signIn.email({
        email,
        password,
      });

      if (signInResult.error) {
        setError(signInResult.error.message ?? 'Sign in failed.');
        return;
      }

      const result = await completeSignInFlow(nextPath);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace(result.path);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const oauthCallbackURL = buildOAuthCallbackURL(nextPath);
  const oauthErrorCallbackURL = buildOAuthErrorCallbackURL('/login', nextPath);

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthBrand />
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Sign in to OmniShift</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <GoogleSignInButton
              callbackURL={oauthCallbackURL}
              errorCallbackURL={oauthErrorCallbackURL}
              disabled={isSubmitting}
              onError={setError}
            />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>
          </FieldGroup>
          {resetSuccess && (
            <p className="mt-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              Your password was updated. Sign in with your new password.
            </p>
          )}
          <form onSubmit={handleSubmit} className="mt-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Link
                    href="/forgot-password"
                    className="text-sm underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
              <Field>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in…' : 'Login'}
                </Button>
                <FieldDescription className="text-center">
                  Creating a new workspace?{' '}
                  <Link href="/register" className="underline-offset-4 hover:underline">
                    Register as owner
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      {IS_DEV && (
        <p className="text-center text-xs text-muted-foreground">
          Demo: demo@example.com / DemoPassword1!
        </p>
      )}
    </div>
  );
}
