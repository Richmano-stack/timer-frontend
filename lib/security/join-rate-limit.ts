import { createFixedWindowRateLimiter, getClientIp } from '@/lib/security/rate-limit';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

// --- Magic-link join (slug + invite token paths) ---

/** Max magic-link requests per IP in a 15-minute window. */
const MAGIC_LINK_IP_LIMIT = 10;
/** Max magic-link requests per email in a 15-minute window. */
const MAGIC_LINK_EMAIL_LIMIT = 5;

const magicLinkIpLimiter = createFixedWindowRateLimiter({
  limit: MAGIC_LINK_IP_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

const magicLinkEmailLimiter = createFixedWindowRateLimiter({
  limit: MAGIC_LINK_EMAIL_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

export type JoinMagicLinkRateLimitScope = 'ip' | 'email';

export type JoinMagicLinkRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; scope: JoinMagicLinkRateLimitScope };

export function checkJoinMagicLinkRateLimit(
  request: Request,
  email: string
): JoinMagicLinkRateLimitResult {
  const ip = getClientIp(request);
  const normalizedEmail = email.trim().toLowerCase();

  const ipResult = magicLinkIpLimiter.check(`join-magic:ip:${ip}`);
  if (!ipResult.allowed) {
    return { ...ipResult, scope: 'ip' };
  }

  const emailResult = magicLinkEmailLimiter.check(`join-magic:email:${normalizedEmail}`);
  if (!emailResult.allowed) {
    return { ...emailResult, scope: 'email' };
  }

  return { allowed: true };
}

// --- Admin invitation creation ---

/** Max invitation creates per organization in a 15-minute window. */
const INVITE_ORG_LIMIT = 10;
/** Max invitation creates per IP in a 15-minute window. */
const INVITE_IP_LIMIT = 20;
/** Max invitation creates per actor (admin user) in a 15-minute window. */
const INVITE_ACTOR_LIMIT = 10;

const inviteIpLimiter = createFixedWindowRateLimiter({
  limit: INVITE_IP_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

const inviteOrgLimiter = createFixedWindowRateLimiter({
  limit: INVITE_ORG_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

const inviteActorLimiter = createFixedWindowRateLimiter({
  limit: INVITE_ACTOR_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

export type InviteCreationRateLimitScope = 'ip' | 'org' | 'actor';

export type InviteCreationRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; scope: InviteCreationRateLimitScope };

export function checkInviteCreationRateLimit(
  request: Request,
  actorUserId: string,
  organizationId: string
): InviteCreationRateLimitResult {
  const ip = getClientIp(request);

  const ipResult = inviteIpLimiter.check(`invite:ip:${ip}`);
  if (!ipResult.allowed) {
    return { ...ipResult, scope: 'ip' };
  }

  const orgResult = inviteOrgLimiter.check(`invite:org:${organizationId}`);
  if (!orgResult.allowed) {
    return { ...orgResult, scope: 'org' };
  }

  const actorResult = inviteActorLimiter.check(`invite:actor:${actorUserId}`);
  if (!actorResult.allowed) {
    return { ...actorResult, scope: 'actor' };
  }

  return { allowed: true };
}

// --- Join-request queue (TKT-106 — export now; wire in route when merged) ---

/** Max join-queue submissions per IP in a 15-minute window. */
const JOIN_REQUEST_IP_LIMIT = 10;
/** Max join-queue submissions per email in a 15-minute window. */
const JOIN_REQUEST_EMAIL_LIMIT = 5;
/** Max join-queue submissions per org slug in a 15-minute window. */
const JOIN_REQUEST_ORG_LIMIT = 30;

const joinRequestIpLimiter = createFixedWindowRateLimiter({
  limit: JOIN_REQUEST_IP_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

const joinRequestEmailLimiter = createFixedWindowRateLimiter({
  limit: JOIN_REQUEST_EMAIL_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

const joinRequestOrgLimiter = createFixedWindowRateLimiter({
  limit: JOIN_REQUEST_ORG_LIMIT,
  windowMs: FIFTEEN_MINUTES_MS,
});

export type JoinRequestRateLimitScope = 'ip' | 'email' | 'org';

export type JoinRequestRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; scope: JoinRequestRateLimitScope };

export function checkJoinRequestRateLimit(
  request: Request,
  email: string,
  orgSlug: string
): JoinRequestRateLimitResult {
  const ip = getClientIp(request);
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOrgSlug = orgSlug.trim().toLowerCase();

  const ipResult = joinRequestIpLimiter.check(`join-request:ip:${ip}`);
  if (!ipResult.allowed) {
    return { ...ipResult, scope: 'ip' };
  }

  const emailResult = joinRequestEmailLimiter.check(`join-request:email:${normalizedEmail}`);
  if (!emailResult.allowed) {
    return { ...emailResult, scope: 'email' };
  }

  const orgResult = joinRequestOrgLimiter.check(`join-request:org:${normalizedOrgSlug}`);
  if (!orgResult.allowed) {
    return { ...orgResult, scope: 'org' };
  }

  return { allowed: true };
}

/** @internal Test helper — clears in-memory counters between tests. */
export function resetJoinRateLimitsForTests(): void {
  magicLinkIpLimiter.reset();
  magicLinkEmailLimiter.reset();
  inviteIpLimiter.reset();
  inviteOrgLimiter.reset();
  inviteActorLimiter.reset();
  joinRequestIpLimiter.reset();
  joinRequestEmailLimiter.reset();
  joinRequestOrgLimiter.reset();
}

export function getJoinRateLimitConfig() {
  return {
    ipLimit: MAGIC_LINK_IP_LIMIT,
    emailLimit: MAGIC_LINK_EMAIL_LIMIT,
    windowMs: FIFTEEN_MINUTES_MS,
  };
}

export function getInviteRateLimitConfig() {
  return {
    ipLimit: INVITE_IP_LIMIT,
    orgLimit: INVITE_ORG_LIMIT,
    actorLimit: INVITE_ACTOR_LIMIT,
    windowMs: FIFTEEN_MINUTES_MS,
  };
}

export function getJoinRequestRateLimitConfig() {
  return {
    ipLimit: JOIN_REQUEST_IP_LIMIT,
    emailLimit: JOIN_REQUEST_EMAIL_LIMIT,
    orgLimit: JOIN_REQUEST_ORG_LIMIT,
    windowMs: FIFTEEN_MINUTES_MS,
  };
}

const MAGIC_LINK_SCOPE_LABELS: Record<JoinMagicLinkRateLimitScope, string> = {
  ip: 'this IP address',
  email: 'this email address',
};

const INVITE_SCOPE_LABELS: Record<InviteCreationRateLimitScope, string> = {
  ip: 'this IP address',
  org: 'this organization',
  actor: 'your account',
};

const JOIN_REQUEST_SCOPE_LABELS: Record<JoinRequestRateLimitScope, string> = {
  ip: 'this IP address',
  email: 'this email address',
  org: 'this organization',
};

export function formatJoinMagicLinkRateLimitMessage(
  result: Extract<JoinMagicLinkRateLimitResult, { allowed: false }>
): string {
  const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
  return `Too many join attempts from ${MAGIC_LINK_SCOPE_LABELS[result.scope]}. Try again in ${retryAfterSeconds} seconds.`;
}

export function formatInviteCreationRateLimitMessage(
  result: Extract<InviteCreationRateLimitResult, { allowed: false }>
): string {
  const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
  return `Too many invitation requests from ${INVITE_SCOPE_LABELS[result.scope]}. Try again in ${retryAfterSeconds} seconds.`;
}

export function formatJoinRequestRateLimitMessage(
  result: Extract<JoinRequestRateLimitResult, { allowed: false }>
): string {
  const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
  return `Too many join requests from ${JOIN_REQUEST_SCOPE_LABELS[result.scope]}. Try again in ${retryAfterSeconds} seconds.`;
}
