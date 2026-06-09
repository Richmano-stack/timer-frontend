import { StatusType } from '@prisma/client';
import { isProductiveType } from '@/lib/utils/status-type';

export function utcNow(): Date {
  return new Date();
}

type SegmentWithStatus = {
  startTime: Date;
  endTime: Date | null;
  activityStatus: {
    name: string;
    type: StatusType;
    colorCode: string;
    isBillable: boolean;
  };
};

export function serializeTimeLogSegment<T extends Record<string, unknown>>(
  segment: T & SegmentWithStatus
) {
  const { activityStatus, startTime, endTime, ...rest } = segment;
  const startIso = startTime instanceof Date ? startTime.toISOString() : String(startTime);
  const endIso = endTime instanceof Date ? endTime.toISOString() : endTime ?? null;

  return {
    ...rest,
    activityStatusId: (rest as { activityStatusId?: string }).activityStatusId ?? '',
    statusName: activityStatus.name,
    type: activityStatus.type,
    colorCode: activityStatus.colorCode,
    isBillable: activityStatus.isBillable,
    isProductive: isProductiveType(activityStatus.type),
    startTime: startIso,
    endTime: endIso != null ? String(endIso) : null,
  };
}

export function segmentDurationMs(startTime: Date, endTime: Date | null, now = utcNow()): number {
  const end = endTime ?? now;
  return Math.max(0, end.getTime() - startTime.getTime());
}

export function computeDaySummaryFromSegments(
  segments: SegmentWithStatus[],
  formatHuman: (ms: number) => string,
  formatHours: (ms: number) => string
): { gross: string; breaks: string; net: string } {
  const now = utcNow();
  let grossMs = 0;
  let breakMs = 0;

  if (segments.length === 0) {
    return { gross: '0m', breaks: '0m', net: '0.0h' };
  }

  const firstStart = segments[0].startTime.getTime();
  const lastEnd = segments[segments.length - 1].endTime ?? now;
  grossMs = Math.max(0, lastEnd.getTime() - firstStart);

  for (const segment of segments) {
    const duration = segmentDurationMs(segment.startTime, segment.endTime, now);
    if (!isProductiveType(segment.activityStatus.type)) {
      breakMs += duration;
    }
  }

  const netMs = Math.max(0, grossMs - breakMs);

  return {
    gross: formatHuman(grossMs),
    breaks: formatHuman(breakMs),
    net: formatHours(netMs),
  };
}
