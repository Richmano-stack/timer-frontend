'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { AuthBrand } from '@/components/auth-brand';
import { authClient } from '@/lib/auth-client';
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

const IS_DEV = process.env.NODE_ENV === 'development';

function isAdminRole(role: string | undefined | null): boolean {
  return role === 'owner' || role === 'admin';
}

interface LoginFormProps extends React.ComponentProps<'div'> {
  initialError?: string | null;
}

export function LoginForm({
  className,
  initialError,
  ...props
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');

  const [email, setEmail] = useState(IS_DEV ? 'demo@example.com' : '');
  const [password, setPassword] = useState(IS_DEV ? 'DemoPassword1!' : '');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

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

      const orgsResult = await authClient.organization.list();
      const organizations = orgsResult.data ?? [];

      if (organizations.length === 0) {
        router.replace('/onboarding');
        router.refresh();
        return;
      }

      const activeResult = await authClient.organization.setActive({
        organizationId: organizations[0].id,
      });

      if (activeResult.error) {
        setError(activeResult.error.message ?? 'Failed to set active organization.');
        return;
      }

      const roleResult = await authClient.organization.getActiveMemberRole();
      const role = roleResult.data?.role;

      if (nextPath) {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      if (isAdminRole(role)) {
        router.replace('/admin/overview');
      } else {
        router.replace('/employee/track');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthBrand />
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
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
                  placeholder="m@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
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
                  Don&apos;t have an account?{' '}
                  <Link href="/register" className="underline-offset-4 hover:underline">
                    Sign up
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
