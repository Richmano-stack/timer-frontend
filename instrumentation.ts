import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

type RequestInfo = {
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
};

type ErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

export async function onRequestError(
  error: unknown,
  request: RequestInfo,
  errorContext: ErrorContext
) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { applySentryTenantFromRequestHeaders } = await import(
      '@/lib/monitoring/sentry-tenant'
    );
    await applySentryTenantFromRequestHeaders(request.headers);
  }

  Sentry.captureRequestError(error, request, errorContext);
}
