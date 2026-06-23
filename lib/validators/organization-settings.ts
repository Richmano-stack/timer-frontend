import { z } from 'zod';

function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const ianaTimezoneSchema = z
  .string()
  .trim()
  .min(1, 'Timezone is required.')
  .max(64, 'Timezone identifier is too long.')
  .refine(isValidIanaTimezone, { message: 'Invalid IANA timezone.' });

const positiveComplianceMinutesSchema = z
  .number()
  .positive('Duration must be greater than zero.')
  .max(480, 'Duration cannot exceed 480 minutes.');

export const updateOrganizationSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Organization name is required.')
      .max(120, 'Organization name is too long.')
      .optional(),
    timezone: ianaTimezoneSchema.optional(),
    maxShiftHours: z
      .number()
      .positive('Max shift hours must be greater than zero.')
      .max(24, 'Max shift hours cannot exceed 24.')
      .optional(),
    maxBreakMinutes: positiveComplianceMinutesSchema.optional(),
    maxLunchMinutes: positiveComplianceMinutesSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.timezone !== undefined ||
      data.maxShiftHours !== undefined ||
      data.maxBreakMinutes !== undefined ||
      data.maxLunchMinutes !== undefined,
    {
      message:
        'At least one of name, timezone, maxShiftHours, maxBreakMinutes, or maxLunchMinutes must be provided.',
    }
  );
