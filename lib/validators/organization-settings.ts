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

export const updateOrganizationSettingsSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Organization name is required.')
      .max(120, 'Organization name is too long.')
      .optional(),
    timezone: ianaTimezoneSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.timezone !== undefined, {
    message: 'At least one of name or timezone must be provided.',
  });
