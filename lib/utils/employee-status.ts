import { ActiveSession, ActivityStatusOption } from '@/types/time-tracking';

export const AVAILABLE_STATUS_ID = '__available__';

export function getEmployeeDisplayStatus(session: ActiveSession | null): {
  label: string;
  isProductive: boolean;
  isOnShift: boolean;
} {
  if (!session) {
    return { label: 'Clocked Out', isProductive: false, isOnShift: false };
  }

  if (session.activeActivity) {
    return {
      label: session.activeActivity.statusName,
      isProductive: session.activeActivity.isProductive,
      isOnShift: true,
    };
  }

  return { label: 'Available', isProductive: true, isOnShift: true };
}

export function getStatusSinceIso(session: ActiveSession | null): string | null {
  if (!session) return null;
  if (session.activeActivity) return session.activeActivity.startTime;
  return session.timeLog.clockIn;
}

export function sortActivityStatuses(statuses: ActivityStatusOption[]): ActivityStatusOption[] {
  return [...statuses].sort((left, right) => {
    if (left.isProductive !== right.isProductive) {
      return left.isProductive ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export function isStatusActive(
  session: ActiveSession | null,
  statusId: string,
  statusName?: string
): boolean {
  if (statusId === AVAILABLE_STATUS_ID) {
    return Boolean(session && !session.activeActivity);
  }

  if (!session?.activeActivity) return false;
  if (statusId && session.activeActivity.statusId === statusId) return true;
  if (statusName && session.activeActivity.statusName === statusName) return true;
  return false;
}
