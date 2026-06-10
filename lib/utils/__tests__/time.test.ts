import { StatusType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  computeDaySummaryFromSegments,
  segmentDurationMs,
} from '@/lib/utils/time';

const formatHuman = (ms: number) => `${Math.floor(ms / 60000)}m`;
const formatHours = (ms: number) => (ms / 3_600_000).toFixed(1) + 'h';

describe('segmentDurationMs', () => {
  it('uses injected now when endTime is null', () => {
    const start = new Date('2026-06-10T09:00:00.000Z');
    const now = new Date('2026-06-10T10:00:00.000Z');

    expect(segmentDurationMs(start, null, now)).toBe(3_600_000);
  });

  it('returns 0 when end is before start', () => {
    const start = new Date('2026-06-10T10:00:00.000Z');
    const end = new Date('2026-06-10T09:00:00.000Z');

    expect(segmentDurationMs(start, end)).toBe(0);
  });
});

describe('computeDaySummaryFromSegments', () => {
  it('returns zero summary for empty segment list', () => {
    expect(computeDaySummaryFromSegments([], formatHuman, formatHours)).toEqual({
      gross: '0m',
      breaks: '0m',
      net: '0.0h',
    });
  });

  it('treats BREAK durations as breakMs, not PRODUCTIVE', () => {
    const now = new Date('2026-06-10T11:00:00.000Z');
    const segments = [
      {
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T10:00:00.000Z'),
        activityStatus: {
          name: 'Available',
          type: StatusType.PRODUCTIVE,
          colorCode: '#000',
          isBillable: true,
        },
      },
      {
        startTime: new Date('2026-06-10T10:00:00.000Z'),
        endTime: new Date('2026-06-10T10:30:00.000Z'),
        activityStatus: {
          name: 'Lunch',
          type: StatusType.BREAK,
          colorCode: '#000',
          isBillable: false,
        },
      },
      {
        startTime: new Date('2026-06-10T10:30:00.000Z'),
        endTime: now,
        activityStatus: {
          name: 'Available',
          type: StatusType.PRODUCTIVE,
          colorCode: '#000',
          isBillable: true,
        },
      },
    ];

    const summary = computeDaySummaryFromSegments(segments, formatHuman, formatHours);

    expect(summary.gross).toBe('120m');
    expect(summary.breaks).toBe('30m');
    expect(summary.net).toBe('1.5h');
  });

  it('computes netMs = grossMs - breakMs with open last segment using now', () => {
    const now = new Date('2026-06-10T12:00:00.000Z');
    const segments = [
      {
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T09:15:00.000Z'),
        activityStatus: {
          name: 'Short Break',
          type: StatusType.BREAK,
          colorCode: '#000',
          isBillable: false,
        },
      },
      {
        startTime: new Date('2026-06-10T09:15:00.000Z'),
        endTime: now,
        activityStatus: {
          name: 'Available',
          type: StatusType.PRODUCTIVE,
          colorCode: '#000',
          isBillable: true,
        },
      },
    ];

    const summary = computeDaySummaryFromSegments(segments, formatHuman, formatHours);

    expect(summary.gross).toBe('180m');
    expect(summary.breaks).toBe('15m');
    expect(summary.net).toBe('2.8h');
  });

  it('handles single-segment shift with no breaks', () => {
    const segments = [
      {
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T11:00:00.000Z'),
        activityStatus: {
          name: 'Available',
          type: StatusType.PRODUCTIVE,
          colorCode: '#000',
          isBillable: true,
        },
      },
    ];

    const summary = computeDaySummaryFromSegments(segments, formatHuman, formatHours);

    expect(summary.gross).toBe('120m');
    expect(summary.breaks).toBe('0m');
    expect(summary.net).toBe('2.0h');
  });
});
