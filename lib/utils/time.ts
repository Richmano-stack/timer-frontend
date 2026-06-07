export function utcNow(): Date {
  return new Date();
}

/**
 * Server-authoritative net duration in whole minutes (gross elapsed minus breaks).
 * All inputs must originate from persisted DB timestamps — never client payloads.
 */
export function computeNetWorkMinutes(
  clockIn: Date,
  clockOut: Date,
  activityLogs: { startTime: Date; endTime: Date | null }[]
): number {
  const grossMs = Math.max(0, clockOut.getTime() - clockIn.getTime());

  let breakMs = 0;
  for (const entry of activityLogs) {
    const breakEnd = entry.endTime ?? clockOut;
    breakMs += Math.max(0, breakEnd.getTime() - entry.startTime.getTime());
  }

  const netMs = Math.max(0, grossMs - breakMs);
  return Math.floor(netMs / (1000 * 60));
}

export function serializeTimeLog<T extends Record<string, unknown>>(timeLog: T): T {
  return {
    ...timeLog,
    clockIn: timeLog.clockIn instanceof Date ? timeLog.clockIn.toISOString() : timeLog.clockIn,
    clockOut:
      timeLog.clockOut instanceof Date
        ? timeLog.clockOut.toISOString()
        : timeLog.clockOut ?? null,
    createdAt:
      timeLog.createdAt instanceof Date ? timeLog.createdAt.toISOString() : timeLog.createdAt,
    updatedAt:
      timeLog.updatedAt instanceof Date ? timeLog.updatedAt.toISOString() : timeLog.updatedAt,
    latitude: timeLog.latitude != null ? String(timeLog.latitude) : null,
    longitude: timeLog.longitude != null ? String(timeLog.longitude) : null,
  };
}

type ActivityLogWithStatus = Record<string, unknown> & {
  statusId?: string;
  status?: {
    id: string;
    name: string;
    isProductive: boolean;
  };
};

export function serializeActivityLog(activityLog: ActivityLogWithStatus) {
  const {
    status,
    statusId: rawStatusId,
    startTime,
    endTime,
    createdAt,
    updatedAt,
    ...rest
  } = activityLog;

  const resolvedStatusId =
    typeof rawStatusId === 'string' ? rawStatusId : status?.id ?? '';

  return {
    ...rest,
    statusId: resolvedStatusId,
    statusName: status?.name ?? '',
    isProductive: status?.isProductive ?? false,
    startTime: startTime instanceof Date ? startTime.toISOString() : startTime,
    endTime: endTime instanceof Date ? endTime.toISOString() : endTime ?? null,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
  };
}
