import { ActiveSession, ActivityStatusOption } from '@/types/time-tracking';
import { AVAILABLE_STATUS_NAME } from '@/lib/utils/status-type';

export const AVAILABLE_STATUS_ID = '__available__';

export function getEmployeeDisplayStatus(session: ActiveSession | null): {
  label: string;
  isProductive: boolean;
  isOnShift: boolean;
} {
  if (!session?.activeSegment) {
    return { label: 'Clocked Out', isProductive: false, isOnShift: false };
  }

  const segment = session.activeSegment;

  return {
    label: segment.statusName,
    isProductive: segment.isProductive,
    isOnShift: true,
  };
}

export function getStatusSinceIso(session: ActiveSession | null): string | null {
  if (!session?.activeSegment) return null;
  return session.activeSegment.startTime;
}

export function sortActivityStatuses(statuses: ActivityStatusOption[]): ActivityStatusOption[] {
  return [...statuses]
    .filter((status) => status.name !== AVAILABLE_STATUS_NAME)
    .sort((left, right) => {
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
  if (!session?.activeSegment) return false;

  if (statusId === AVAILABLE_STATUS_ID) {
    return session.activeSegment.statusName === AVAILABLE_STATUS_NAME;
  }

  if (statusId && session.activeSegment.activityStatusId === statusId) return true;
  if (statusName && session.activeSegment.statusName === statusName) return true;
  return false;
}
