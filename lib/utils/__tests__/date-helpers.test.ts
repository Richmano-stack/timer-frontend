import { describe, expect, it } from 'vitest';
import {
  getOrganizationDateRange,
  getOrganizationDayRange,
  getOrganizationLocalDateString,
  getOrganizationTodayDateString,
  resolveOrganizationTimezone,
} from '@/lib/utils/date-helpers';

describe('resolveOrganizationTimezone', () => {
  it('returns UTC for empty or invalid values', () => {
    expect(resolveOrganizationTimezone(undefined)).toBe('UTC');
    expect(resolveOrganizationTimezone(null)).toBe('UTC');
    expect(resolveOrganizationTimezone('')).toBe('UTC');
    expect(resolveOrganizationTimezone('Not/A/Timezone')).toBe('UTC');
  });

  it('returns valid IANA identifiers unchanged', () => {
    expect(resolveOrganizationTimezone('America/New_York')).toBe('America/New_York');
    expect(resolveOrganizationTimezone(' UTC ')).toBe('UTC');
  });
});

describe('getOrganizationDayRange', () => {
  it('uses UTC midnight boundaries for UTC timezone', () => {
    const { rangeStart, rangeEnd } = getOrganizationDayRange('UTC', '2026-06-10');

    expect(rangeStart.toISOString()).toBe('2026-06-10T00:00:00.000Z');
    expect(rangeEnd.toISOString()).toBe('2026-06-10T23:59:59.999Z');
  });

  it('uses America/New_York local midnight boundaries (EDT, UTC-4)', () => {
    const { rangeStart, rangeEnd } = getOrganizationDayRange('America/New_York', '2026-06-10');

    expect(rangeStart.toISOString()).toBe('2026-06-10T04:00:00.000Z');
    expect(rangeEnd.toISOString()).toBe('2026-06-11T03:59:59.999Z');
  });

  it('handles America/New_York EST (UTC-5) during standard time', () => {
    const { rangeStart, rangeEnd } = getOrganizationDayRange('America/New_York', '2026-01-15');

    expect(rangeStart.toISOString()).toBe('2026-01-15T05:00:00.000Z');
    expect(rangeEnd.toISOString()).toBe('2026-01-16T04:59:59.999Z');
  });

  it('falls back to UTC boundaries for invalid timezone', () => {
    const { rangeStart, rangeEnd } = getOrganizationDayRange('Invalid/Zone', '2026-06-10');

    expect(rangeStart.toISOString()).toBe('2026-06-10T00:00:00.000Z');
    expect(rangeEnd.toISOString()).toBe('2026-06-10T23:59:59.999Z');
  });
});

describe('getOrganizationDateRange', () => {
  it('spans inclusive local days in UTC', () => {
    const { rangeStart, rangeEnd } = getOrganizationDateRange('UTC', '2026-06-09', '2026-06-10');

    expect(rangeStart.toISOString()).toBe('2026-06-09T00:00:00.000Z');
    expect(rangeEnd.toISOString()).toBe('2026-06-10T23:59:59.999Z');
  });

  it('spans inclusive local days in America/New_York', () => {
    const { rangeStart, rangeEnd } = getOrganizationDateRange(
      'America/New_York',
      '2026-06-09',
      '2026-06-10'
    );

    expect(rangeStart.toISOString()).toBe('2026-06-09T04:00:00.000Z');
    expect(rangeEnd.toISOString()).toBe('2026-06-11T03:59:59.999Z');
  });
});

describe('getOrganizationLocalDateString', () => {
  it('maps UTC instants to local calendar dates in UTC', () => {
    expect(getOrganizationLocalDateString(new Date('2026-06-10T23:30:00.000Z'), 'UTC')).toBe(
      '2026-06-10'
    );
  });

  it('maps UTC instants to local calendar dates in America/New_York', () => {
    expect(
      getOrganizationLocalDateString(new Date('2026-06-10T03:30:00.000Z'), 'America/New_York')
    ).toBe('2026-06-09');
    expect(
      getOrganizationLocalDateString(new Date('2026-06-10T04:30:00.000Z'), 'America/New_York')
    ).toBe('2026-06-10');
  });
});

describe('getOrganizationTodayDateString', () => {
  it('returns the local calendar date for a provided instant', () => {
    const now = new Date('2026-06-10T03:30:00.000Z');
    expect(getOrganizationTodayDateString('America/New_York', now)).toBe('2026-06-09');
    expect(getOrganizationTodayDateString('UTC', now)).toBe('2026-06-10');
  });
});
