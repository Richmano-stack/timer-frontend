import { z } from 'zod';

const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: 'Must be a valid ISO 8601 datetime.' });

export const patchTimesheetSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(10, 'reason must be at least 10 characters.'),
    clockIn: isoDateTimeSchema.optional(),
    clockOut: isoDateTimeSchema.nullable().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) =>
      data.clockIn !== undefined ||
      data.clockOut !== undefined ||
      data.notes !== undefined,
    { message: 'At least one of clockIn, clockOut, or notes must be provided.' }
  );

export type PatchTimesheetInput = z.infer<typeof patchTimesheetSchema>;
