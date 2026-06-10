export interface OrganizationJoinMetadata {
  allowedDomains: string[];
}

export function parseOrganizationMetadata(
  raw: string | null | undefined
): OrganizationJoinMetadata | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OrganizationJoinMetadata>;
    if (!parsed || typeof parsed !== 'object') return null;

    const allowedDomains = Array.isArray(parsed.allowedDomains)
      ? parsed.allowedDomains
          .filter((domain): domain is string => typeof domain === 'string')
          .map((domain) => normalizeDomain(domain))
          .filter(Boolean)
      : [];

    return { allowedDomains };
  } catch {
    return null;
  }
}

export function serializeOrganizationMetadata(metadata: OrganizationJoinMetadata): string {
  return JSON.stringify({
    allowedDomains: metadata.allowedDomains.map(normalizeDomain).filter(Boolean),
  });
}

export function createDefaultJoinMetadata(ownerEmail: string): OrganizationJoinMetadata {
  const domain = extractEmailDomain(ownerEmail);
  return {
    allowedDomains: domain ? [domain] : [],
  };
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, '');
}

export function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex < 0 || atIndex === normalized.length - 1) return null;
  return normalizeDomain(normalized.slice(atIndex + 1));
}

export function emailMatchesAllowedDomains(email: string, allowedDomains: string[]): boolean {
  const domain = extractEmailDomain(email);
  if (!domain || allowedDomains.length === 0) return false;
  return allowedDomains.some((allowed) => domain === normalizeDomain(allowed));
}
