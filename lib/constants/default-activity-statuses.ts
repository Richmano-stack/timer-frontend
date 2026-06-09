import { StatusType } from '@prisma/client';

export { AVAILABLE_STATUS_NAME } from '@/lib/utils/status-type';

export interface DefaultActivityStatus {
  name: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
}

export const DEFAULT_ACTIVITY_STATUSES: DefaultActivityStatus[] = [
  { name: 'Available', type: StatusType.PRODUCTIVE, colorCode: '#6366f1', isBillable: true },
  {
    name: 'Handling Contact',
    type: StatusType.PRODUCTIVE,
    colorCode: '#4f46e5',
    isBillable: true,
  },
  {
    name: 'After Call Work',
    type: StatusType.PRODUCTIVE,
    colorCode: '#4338ca',
    isBillable: true,
  },
  { name: 'Back Office', type: StatusType.PRODUCTIVE, colorCode: '#3730a3', isBillable: true },
  { name: 'Lunch', type: StatusType.BREAK, colorCode: '#94a3b8', isBillable: false },
  { name: 'Short Break', type: StatusType.BREAK, colorCode: '#64748b', isBillable: false },
  { name: 'Training', type: StatusType.TRAINING, colorCode: '#818cf8', isBillable: true },
  {
    name: 'System Issue',
    type: StatusType.SYSTEM_ISSUE,
    colorCode: '#475569',
    isBillable: false,
  },
];
