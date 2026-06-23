import type { BrowserOptions, EdgeOptions, NodeOptions } from '@sentry/nextjs';
import { getClientSentryDsn, getServerSentryDsn, isSentryEnabled } from '@/lib/monitoring/sentry-dsn';
import { scrubSentryEvent } from '@/lib/monitoring/sentry-sanitize';

function baseOptions(dsn: string | undefined): Pick<NodeOptions, 'dsn' | 'enabled' | 'environment' | 'beforeSend' | 'sendDefaultPii'> {
  return {
    dsn,
    enabled: isSentryEnabled(dsn),
    environment: process.env.NODE_ENV,
    beforeSend: scrubSentryEvent,
    sendDefaultPii: false,
  };
}

export function createServerSentryOptions(): NodeOptions {
  const dsn = getServerSentryDsn();

  return {
    ...baseOptions(dsn),
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  };
}

export function createEdgeSentryOptions(): EdgeOptions {
  const dsn = getServerSentryDsn();

  return {
    ...baseOptions(dsn),
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  };
}

export function createClientSentryOptions(): BrowserOptions {
  const dsn = getClientSentryDsn();

  return {
    ...baseOptions(dsn),
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
  };
}
