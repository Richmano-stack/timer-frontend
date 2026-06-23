import type { ErrorEvent } from '@sentry/nextjs';

const SENSITIVE_KEY_PATTERN =
  /password|passwd|cookie|authorization|bearer|token|secret|magic.?link|session.?id/i;

const SENSITIVE_QUERY_PATTERN =
  /(?:^|[?&])(?:token|code|password|secret|magic[_-]?link)=/i;

function scrubValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[Filtered]';
  }

  if (typeof value === 'string' && SENSITIVE_QUERY_PATTERN.test(value)) {
    return '[Filtered]';
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return scrubRecord(value as Record<string, unknown>);
  }

  return value;
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    scrubbed[key] = scrubValue(key, value);
  }

  return scrubbed;
}

function scrubRequestHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) {
    return headers;
  }

  const scrubbed = { ...headers };

  for (const key of Object.keys(scrubbed)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      scrubbed[key] = '[Filtered]';
    }
  }

  return scrubbed;
}

/**
 * Strip passwords, cookies, auth headers, and magic-link tokens before events leave the app.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.request?.headers) {
    event.request.headers = scrubRequestHeaders(
      event.request.headers as Record<string, string>
    );
  }

  if (event.request?.cookies) {
    event.request.cookies = {};
  }

  if (typeof event.request?.query_string === 'string') {
    if (SENSITIVE_QUERY_PATTERN.test(event.request.query_string)) {
      event.request.query_string = '[Filtered]';
    }
  }

  if (event.extra) {
    event.extra = scrubRecord(event.extra as Record<string, unknown>);
  }

  if (event.contexts) {
    event.contexts = scrubRecord(event.contexts as Record<string, unknown>);
  }

  return event;
}
