import { StatusType } from '@prisma/client';

export const STATUS_TYPE_LABELS: Record<StatusType, string> = {
  [StatusType.PRODUCTIVE]: 'Productive',
  [StatusType.BREAK]: 'Break',
  [StatusType.TRAINING]: 'Training',
  [StatusType.SYSTEM_ISSUE]: 'System issue',
};

export const STATUS_TYPE_OPTIONS = Object.values(StatusType).map((value) => ({
  value,
  label: STATUS_TYPE_LABELS[value],
}));
