export const reportsKeys = {
  all: ['reports'] as const,
  settings: () => ['organization', 'settings'] as const,
  team: () => ['organization', 'team'] as const,
  timesheets: (startDate: string, endDate: string) =>
    [...reportsKeys.all, 'timesheets', startDate, endDate] as const,
};
