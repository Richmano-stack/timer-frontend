'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { AuthBrand } from '@/components/auth-brand';
import { authClient } from '@/lib/auth-client';
import type { ResolvedInvitation } from '@/lib/invitations/resolve-invitation-token';
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

interface SignupFormProps extends React.ComponentProps<'div'> {
  invitation?: ResolvedInvitation | null;
  inviteToken?: string;
}

export function SignupForm({
  className,
  invitation,
  inviteToken,
  ...props
}: SignupFormProps) {
  const router = useRouter();
  const isInviteFlow = Boolean(invitation && inviteToken);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(invitation?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const signUpResult = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (signUpResult.error) {
        setError(signUpResult.error.message ?? 'Sign up failed.');
        return;
      }

      if (isInviteFlow && inviteToken) {
        const acceptResult = await authClient.organization.acceptInvitation({
          invitationId: inviteToken,
        });

        if (acceptResult.error) {
          setError(acceptResult.error.message ?? 'Failed to accept invitation.');
          return;
        }

        const organizationId =
          acceptResult.data?.member?.organizationId ?? invitation?.organizationId;

        if (!organizationId) {
          setError('Invitation was accepted but no organization was returned.');
          return;
        }

        const activeResult = await authClient.organization.setActive({
          organizationId,
        });

        if (activeResult.error) {
          setError(activeResult.error.message ?? 'Failed to set active organization.');
          return;
        }

        router.replace('/employee/track');
        router.refresh();
        return;
      }

      router.replace('/onboarding');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <AuthBrand />
      <Card>
        <CardHeader>
          <CardTitle>
            {isInviteFlow ? 'Join your team' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {isInviteFlow
              ? `You have been invited to join ${invitation?.organizationName}. Create your account to get started.`
              : 'Enter your information below to create your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Full Name</FieldLabel>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isSubmitting}
                />
              </Field>
              {isInviteFlow && (
                <Field>
                  <FieldLabel htmlFor="organization">Organization</FieldLabel>
                  <Input
                    id="organization"
                    type="text"
                    value={invitation?.organizationName ?? ''}
                    readOnly
                    disabled
                  />
                  <FieldDescription>
                    You will join as a team member after creating your account.
                  </FieldDescription>
                </Field>
              )}
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
                  disabled={isSubmitting || isInviteFlow}
                  readOnly={isInviteFlow}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                />
                <FieldDescription>Must be at least 8 characters long.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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
                  {isSubmitting
                    ? isInviteFlow
                      ? 'Joining team…'
                      : 'Creating account…'
                    : isInviteFlow
                      ? 'Create Account & Join'
                      : 'Create Account'}
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
