'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { completeSignInFlow } from '@/lib/auth/complete-sign-in';

export function OAuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await completeSignInFlow(nextPath);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace(result.path);
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  if (error) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
        <button
          type="button"
          className="text-sm underline-offset-4 hover:underline"
          onClick={() => router.replace('/login')}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-brand-accent" />
      <p className="text-sm text-muted-foreground">Completing sign-in…</p>
    </div>
  );
}
