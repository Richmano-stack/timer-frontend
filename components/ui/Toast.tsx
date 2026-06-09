'use client';

import { useEffect } from 'react';

export interface ToastProps {
  message: string;
  code?: string | null;
  variant?: 'error' | 'success';
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({
  message,
  code,
  variant = 'error',
  onDismiss,
  durationMs = 5000,
}: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, durationMs]);

  const borderClass =
    variant === 'success'
      ? 'border-brand-accent/40 ring-brand-accent/10'
      : 'border-border ring-border/20';

  const iconClass = variant === 'success' ? 'text-brand-accent' : 'text-muted-foreground';

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full max-w-sm rounded-lg border bg-card p-4 shadow-lg ring-1 ${borderClass}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 text-lg ${iconClass}`}>{variant === 'success' ? '✓' : '!'}</div>
        <div className="min-w-0 flex-1">
          {code && (
            <p className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {code}
            </p>
          )}
          <p className="text-sm leading-relaxed text-foreground">{message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground transition hover:text-foreground"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastStack({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {children}
    </div>
  );
}
