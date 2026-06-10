import { createFixedWindowRateLimiter, getClientIp } from '@/lib/security/rate-limit';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/** Max magic-link requests per IP in a 15-minute window. */
const IP_LIMIT = 10;
/** Max magic-link requests per email in a 15-minute window. */
const EMAIL_LIMIT = 5;

const ipLimiter = createFixedWindowRateLimiter({
  limit: IP_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

const emailLimiter = createFixedWindowRateLimiter({
  limit: EMAIL_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

export type JoinRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; scope: 'ip' | 'email' };

export function checkJoinMagicLinkRateLimit(
  request: Request,
  email: string
): JoinRateLimitResult {
  const ip = getClientIp(request);
  const normalizedEmail = email.trim().toLowerCase();

  const ipResult = ipLimiter.check(`join:ip:${ip}`);
  if (!ipResult.allowed) {
    return { ...ipResult, scope: 'ip' };
  }

  const emailResult = emailLimiter.check(`join:email:${normalizedEmail}`);
  if (!emailResult.allowed) {
    return { ...emailResult, scope: 'email' };
  }

  return { allowed: true };
}

/** @internal Test helper — clears in-memory counters between tests. */
export function resetJoinRateLimitsForTests(): void {
  ipLimiter.reset();
  emailLimiter.reset();
}

export function getJoinRateLimitConfig() {
  return {
    ipLimit: IP_LIMIT,
    emailLimit: EMAIL_LIMIT,
    windowMs: FIFTEEN_MINUTES_MS,
  };
}
