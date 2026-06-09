import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

function resolveLoginError(error: string | undefined): string | null {
  if (error === 'invalid_invite') {
    return 'This invitation link is invalid or has expired.';
  }
  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const initialError = resolveLoginError(error);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="h-80 w-full animate-pulse rounded-xl border border-border bg-card" />
          }
        >
          <LoginForm initialError={initialError} />
        </Suspense>
      </div>
    </div>
  );
}
