import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_BREAK_MINUTES,
  DEFAULT_MAX_LUNCH_MINUTES,
  DEFAULT_MAX_SHIFT_HOURS,
  isLunchStatusName,
  resolveComplianceLimits,
  resolveComplianceLimitsFromMetadata,
  resolveMaxShiftHours,
} from '@/lib/organization/compliance-limits';

describe('resolveComplianceLimitsFromMetadata', () => {
  it('returns defaults when metadata is null', () => {
    expect(resolveComplianceLimitsFromMetadata(null)).toEqual({
      maxShiftHours: DEFAULT_MAX_SHIFT_HOURS,
      maxBreakMinutes: DEFAULT_MAX_BREAK_MINUTES,
      maxLunchMinutes: DEFAULT_MAX_LUNCH_MINUTES,
      maxShiftDurationMs: DEFAULT_MAX_SHIFT_HOURS * 60 * 60 * 1000,
      maxBreakDurationMs: DEFAULT_MAX_BREAK_MINUTES * 60 * 1000,
      maxLunchDurationMs: DEFAULT_MAX_LUNCH_MINUTES * 60 * 1000,
    });
  });

  it('uses org-specific values when present', () => {
    expect(
      resolveComplianceLimitsFromMetadata({
        allowedDomains: ['acme.com'],
        maxShiftHours: 8,
        maxBreakMinutes: 15,
        maxLunchMinutes: 45,
      })
    ).toEqual({
      maxShiftHours: 8,
      maxBreakMinutes: 15,
      maxLunchMinutes: 45,
      maxShiftDurationMs: 8 * 60 * 60 * 1000,
      maxBreakDurationMs: 15 * 60 * 1000,
      maxLunchDurationMs: 45 * 60 * 1000,
    });
  });

  it('ignores invalid numeric values', () => {
    expect(
      resolveComplianceLimitsFromMetadata({
        allowedDomains: [],
        maxShiftHours: -1,
        maxBreakMinutes: 0,
        maxLunchMinutes: Number.NaN,
      })
    ).toEqual({
      maxShiftHours: DEFAULT_MAX_SHIFT_HOURS,
      maxBreakMinutes: DEFAULT_MAX_BREAK_MINUTES,
      maxLunchMinutes: DEFAULT_MAX_LUNCH_MINUTES,
      maxShiftDurationMs: DEFAULT_MAX_SHIFT_HOURS * 60 * 60 * 1000,
      maxBreakDurationMs: DEFAULT_MAX_BREAK_MINUTES * 60 * 1000,
      maxLunchDurationMs: DEFAULT_MAX_LUNCH_MINUTES * 60 * 1000,
    });
  });
});

describe('resolveComplianceLimits', () => {
  it('parses metadata JSON from organization record', () => {
    const limits = resolveComplianceLimits({
      metadata: JSON.stringify({
        allowedDomains: ['acme.com'],
        maxShiftHours: 6,
      }),
    });

    expect(limits.maxShiftHours).toBe(6);
    expect(limits.maxBreakMinutes).toBe(DEFAULT_MAX_BREAK_MINUTES);
  });
});

describe('resolveMaxShiftHours', () => {
  it('delegates to compliance limits resolver', () => {
    expect(resolveMaxShiftHours(null)).toBe(DEFAULT_MAX_SHIFT_HOURS);
    expect(
      resolveMaxShiftHours(JSON.stringify({ allowedDomains: [], maxShiftHours: 10 }))
    ).toBe(10);
  });
});

describe('isLunchStatusName', () => {
  it('matches lunch by name case-insensitively', () => {
    expect(isLunchStatusName('Lunch')).toBe(true);
    expect(isLunchStatusName('extended lunch')).toBe(true);
    expect(isLunchStatusName('Short Break')).toBe(false);
  });
});
