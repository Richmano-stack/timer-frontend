export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

interface Bucket {
  count: number;
  windowStartMs: number;
}

export interface FixedWindowRateLimiter {
  check(key: string, nowMs?: number): RateLimitResult;
  reset(): void;
}

/**
 * In-memory fixed-window rate limiter.
 * Suitable for single-node deployments; use Redis/Upstash for multi-instance production.
 */
export function createFixedWindowRateLimiter(options: {
  limit: number;
  windowMs: number;
}): FixedWindowRateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string, nowMs = Date.now()): RateLimitResult {
      const bucket = buckets.get(key);

      if (!bucket || nowMs - bucket.windowStartMs >= options.windowMs) {
        buckets.set(key, { count: 1, windowStartMs: nowMs });
        return { allowed: true };
      }

      if (bucket.count >= options.limit) {
        const retryAfterMs = options.windowMs - (nowMs - bucket.windowStartMs);
        return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 1) };
      }

      bucket.count += 1;
      return { allowed: true };
    },
    reset() {
      buckets.clear();
    },
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const cfConnectingIp = request.headers.get('cf-connecting-ip')?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  return 'unknown';
}
