export const activityStatusKeys = {
  all: ['activity-statuses'] as const,
  list: () => [...activityStatusKeys.all, 'list'] as const,
};
