import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupForm } from '@/components/signup-form';

export const metadata: Metadata = {
  title: 'Create workspace',
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="h-80 w-full animate-pulse rounded-xl border border-border bg-card" />
          }
        >
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
