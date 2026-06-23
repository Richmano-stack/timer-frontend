export interface OrganizationJoinMetadata {
  allowedDomains: string[];
  /** Join approval gate — mirrored in Organization.joinPolicy column (TKT-201); kept in JSON during transition. */
  requireApproval?: boolean;
  /** IANA timezone — mirrored in Organization.timezone column (TKT-201); kept in JSON during transition. */
  timezone?: string;
  /**
   * Max continuous open-shift hours before automated clock-out (TKT-207).
   * Superseded by the TKT-206 compliance engine when available.
   */
  maxShiftHours?: number;
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

    const requireApproval =
      typeof parsed.requireApproval === 'boolean' ? parsed.requireApproval : undefined;

    const timezone =
      typeof parsed.timezone === 'string' && parsed.timezone.trim().length > 0
        ? parsed.timezone.trim()
        : undefined;

    const maxShiftHours =
      typeof parsed.maxShiftHours === 'number' &&
      Number.isFinite(parsed.maxShiftHours) &&
      parsed.maxShiftHours > 0
        ? parsed.maxShiftHours
        : undefined;

    return {
      allowedDomains,
      ...(requireApproval !== undefined ? { requireApproval } : {}),
      ...(timezone !== undefined ? { timezone } : {}),
      ...(maxShiftHours !== undefined ? { maxShiftHours } : {}),
    };
  } catch {
    return null;
  }
}

export function serializeOrganizationMetadata(metadata: OrganizationJoinMetadata): string {
  const payload: OrganizationJoinMetadata = {
    allowedDomains: metadata.allowedDomains.map(normalizeDomain).filter(Boolean),
  };
  if (metadata.requireApproval !== undefined) {
    payload.requireApproval = metadata.requireApproval;
  }
  if (metadata.timezone !== undefined) {
    payload.timezone = metadata.timezone;
  }
  if (metadata.maxShiftHours !== undefined) {
    payload.maxShiftHours = metadata.maxShiftHours;
  }
  return JSON.stringify(payload);
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
