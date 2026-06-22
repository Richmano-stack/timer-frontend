export type RegistrationPermitReason =
  | 'owner_bootstrap'
  | 'join_magic_link'
  | 'invitation';

interface RegistrationPermit {
  email: string;
  reason: RegistrationPermitReason;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

const permits = new Map<string, RegistrationPermit>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function purgeExpiredPermit(email: string): void {
  const permit = permits.get(email);
  if (!permit) return;

  if (permit.expiresAt <= Date.now()) {
    permits.delete(email);
  }
}

export function grantRegistrationPermit(
  email: string,
  reason: RegistrationPermitReason,
  ttlMs = DEFAULT_TTL_MS
): void {
  const normalizedEmail = normalizeEmail(email);
  permits.set(normalizedEmail, {
    email: normalizedEmail,
    reason,
    expiresAt: Date.now() + ttlMs,
  });
}

export function hasActiveRegistrationPermit(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  purgeExpiredPermit(normalizedEmail);
  return permits.has(normalizedEmail);
}

export function consumeRegistrationPermit(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  purgeExpiredPermit(normalizedEmail);

  const permit = permits.get(normalizedEmail);
  if (!permit) {
    return false;
  }

  permits.delete(normalizedEmail);
  return true;
}

export function clearRegistrationPermitsForTests(): void {
  permits.clear();
}
