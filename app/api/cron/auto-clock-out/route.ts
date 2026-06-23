import { timingSafeEqual } from 'node:crypto';
import { executePublicRoute, fail, ok } from '@/lib/http/api-handler';
import { cronConfig } from '@/lib/env';
import { runAutoClockOutJob } from '@/lib/services/cron-auto-clockout.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';

/**
 * Cron authentication accepts either:
 * - `x-cron-secret: <secret>` (preferred for schedulers)
 * - `Authorization: Bearer <secret>`
 */
function extractCronSecret(request: Request): string | null {
  const headerSecret = request.headers.get('x-cron-secret')?.trim();
  if (headerSecret) return headerSecret;

  const authorization = request.headers.get('authorization')?.trim();
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return null;
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isCronAuthorized(request: Request): boolean {
  const configuredSecret = cronConfig.secret;
  if (!configuredSecret) {
    return false;
  }

  const providedSecret = extractCronSecret(request);
  if (!providedSecret) {
    return false;
  }

  return secretsMatch(providedSecret, configuredSecret);
}

async function handleCronRequest(request: Request) {
  return executePublicRoute(request, async () => {
    if (!isCronAuthorized(request)) {
      return fail(
        TimeTrackingErrorCodes.UNAUTHORIZED,
        'Invalid or missing cron secret.',
        401
      );
    }

    try {
      const result = await runAutoClockOutJob();
      return ok(result);
    } catch (error) {
      console.error('[cron/auto-clock-out] Unhandled error:', error);
      return fail(
        TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
        'Automated clock-out job failed.',
        500
      );
    }
  });
}

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}
