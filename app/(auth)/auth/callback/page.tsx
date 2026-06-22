import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OAuthCallbackHandler } from '@/components/auth/oauth-callback-handler';

export const metadata: Metadata = {
  title: 'Signing in',
};

export default function OAuthCallbackPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-brand-accent" />
              <p className="text-sm text-muted-foreground">Completing sign-in…</p>
            </div>
          }
        >
          <OAuthCallbackHandler />
        </Suspense>
      </div>
    </div>
  );
}
