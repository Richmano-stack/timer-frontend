import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordForm } from './_components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="h-72 w-full animate-pulse rounded-xl border border-border bg-card" />
          }
        >
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
