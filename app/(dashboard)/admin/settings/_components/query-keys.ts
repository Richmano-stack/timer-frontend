export const organizationKeys = {
  all: ['organization'] as const,
  settings: () => [...organizationKeys.all, 'settings'] as const,
  auditLogs: (actionFilter: string) =>
    [...organizationKeys.all, 'audit-logs', actionFilter] as const,
};
