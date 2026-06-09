import { StatusType } from '@prisma/client';

export const AVAILABLE_STATUS_NAME = 'Available';

export function isProductiveType(type: StatusType): boolean {
  return type === StatusType.PRODUCTIVE || type === StatusType.TRAINING;
}

export function isBreakType(type: StatusType): boolean {
  return type === StatusType.BREAK || type === StatusType.SYSTEM_ISSUE;
}
