export const ActivityStatusErrorCodes = {
  ACTIVITY_STATUS_NAME_CONFLICT: 'ACTIVITY_STATUS_NAME_CONFLICT',
  ACTIVITY_STATUS_IN_USE: 'ACTIVITY_STATUS_IN_USE',
} as const;

export type ActivityStatusErrorCode =
  (typeof ActivityStatusErrorCodes)[keyof typeof ActivityStatusErrorCodes];
