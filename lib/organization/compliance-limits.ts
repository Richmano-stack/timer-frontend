import {
  parseOrganizationMetadata,
  type OrganizationJoinMetadata,
} from '@/lib/organization/metadata';

/** Default max continuous open-shift hours (matches legacy TWELVE_HOURS_MS behavior). */
export const DEFAULT_MAX_SHIFT_HOURS = 12;

/** Default max regular break duration in minutes (matches legacy THIRTY_MINUTES_MS behavior). */
export const DEFAULT_MAX_BREAK_MINUTES = 30;

/** Default max lunch duration in minutes (matches legacy THIRTY_MINUTES_MS behavior). */
export const DEFAULT_MAX_LUNCH_MINUTES = 30;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

export interface ComplianceLimits {
  maxShiftHours: number;
  maxBreakMinutes: number;
  maxLunchMinutes: number;
  maxShiftDurationMs: number;
  maxBreakDurationMs: number;
  maxLunchDurationMs: number;
}

export interface OrganizationComplianceSource {
  metadata?: string | null;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function toComplianceLimits(
  maxShiftHours: number,
  maxBreakMinutes: number,
  maxLunchMinutes: number
): ComplianceLimits {
  return {
    maxShiftHours,
    maxBreakMinutes,
    maxLunchMinutes,
    maxShiftDurationMs: maxShiftHours * MS_PER_HOUR,
    maxBreakDurationMs: maxBreakMinutes * MS_PER_MINUTE,
    maxLunchDurationMs: maxLunchMinutes * MS_PER_MINUTE,
  };
}

export function resolveComplianceLimitsFromMetadata(
  metadata: OrganizationJoinMetadata | null | undefined
): ComplianceLimits {
  const maxShiftHours =
    positiveNumber(metadata?.maxShiftHours) ?? DEFAULT_MAX_SHIFT_HOURS;
  const maxBreakMinutes =
    positiveNumber(metadata?.maxBreakMinutes) ?? DEFAULT_MAX_BREAK_MINUTES;
  const maxLunchMinutes =
    positiveNumber(metadata?.maxLunchMinutes) ?? DEFAULT_MAX_LUNCH_MINUTES;

  return toComplianceLimits(maxShiftHours, maxBreakMinutes, maxLunchMinutes);
}

export function resolveComplianceLimits(
  organization: OrganizationComplianceSource | null | undefined
): ComplianceLimits {
  const metadata = parseOrganizationMetadata(organization?.metadata ?? null);
  return resolveComplianceLimitsFromMetadata(metadata);
}

export function resolveMaxShiftHours(metadataRaw: string | null | undefined): number {
  return resolveComplianceLimits({ metadata: metadataRaw }).maxShiftHours;
}

/** Distinguish lunch from other break statuses by activity status name. */
export function isLunchStatusName(name: string): boolean {
  return name.trim().toLowerCase().includes('lunch');
}

export const AUTO_CLOCK_OUT_NOTE =
  '[System] Automated clock-out: shift exceeded the maximum continuous duration threshold.';
