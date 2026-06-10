import { StatusType } from '@prisma/client';

export const ORG_ID = 'org-1';
export const USER_ID = 'user-1';
export const OTHER_USER_ID = 'user-2';

export function makeActivityStatus(
  overrides: Partial<{
    id: string;
    name: string;
    type: StatusType;
    colorCode: string;
    isBillable: boolean;
  }> = {}
) {
  return {
    id: 'status-available',
    name: 'Available',
    type: StatusType.PRODUCTIVE,
    colorCode: '#6366f1',
    isBillable: true,
    ...overrides,
  };
}

export function makeTimeLogSegment(
  overrides: Partial<{
    id: string;
    userId: string;
    organizationId: string;
    activityStatusId: string;
    startTime: Date;
    endTime: Date | null;
    notes: string | null;
    activityStatus: ReturnType<typeof makeActivityStatus>;
  }> = {}
) {
  const activityStatus = overrides.activityStatus ?? makeActivityStatus();
  return {
    id: 'seg-1',
    userId: USER_ID,
    organizationId: ORG_ID,
    activityStatusId: activityStatus.id,
    startTime: new Date('2026-06-10T09:00:00.000Z'),
    endTime: null,
    notes: null,
    activityStatus,
    ...overrides,
  };
}
