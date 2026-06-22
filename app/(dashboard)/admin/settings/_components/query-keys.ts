export const organizationKeys = {
  all: ['organization'] as const,
  settings: () => [...organizationKeys.all, 'settings'] as const,
};
