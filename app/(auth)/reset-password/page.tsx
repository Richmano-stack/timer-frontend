import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from './_components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset password',
};

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="h-80 w-full animate-pulse rounded-xl border border-border bg-card" />
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
