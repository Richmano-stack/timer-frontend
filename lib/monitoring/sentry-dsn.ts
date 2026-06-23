/**
 * Server and edge runtimes read SENTRY_DSN.
 * The browser requires NEXT_PUBLIC_SENTRY_DSN (same ingest URL in production).
 */
export function getServerSentryDsn(): string | undefined {
  const dsn = process.env.SENTRY_DSN?.trim();
  return dsn || undefined;
}

export function getClientSentryDsn(): string | undefined {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return dsn || undefined;
}

export function isSentryEnabled(dsn: string | undefined): boolean {
  return Boolean(dsn);
}
