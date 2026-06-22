export const organizationKeys = {
  all: ['organization'] as const,
  team: () => [...organizationKeys.all, 'team'] as const,
  invitations: () => [...organizationKeys.all, 'invitations'] as const,
  joinRequests: () => [...organizationKeys.all, 'join-requests'] as const,
  joinSettings: () => [...organizationKeys.all, 'join-settings'] as const,
};

/** Placeholder until Phase 3 billing exposes seat limits from Stripe. */
export const SEAT_LIMIT_PLACEHOLDER = 25;
