import { StatusType } from '@prisma/client';
import { z } from 'zod';

const hexColorSchema = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Color must be a valid hex code (e.g. #6366f1).');

const activityStatusNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required.')
  .max(80, 'Name must be 80 characters or fewer.');

export const createActivityStatusSchema = z.object({
  name: activityStatusNameSchema,
  type: z.nativeEnum(StatusType, { errorMap: () => ({ message: 'Invalid status type.' }) }),
  colorCode: hexColorSchema,
  isBillable: z.boolean(),
});

export const updateActivityStatusSchema = z
  .object({
    name: activityStatusNameSchema.optional(),
    type: z.nativeEnum(StatusType, { errorMap: () => ({ message: 'Invalid status type.' }) }).optional(),
    colorCode: hexColorSchema.optional(),
    isBillable: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.type !== undefined ||
      data.colorCode !== undefined ||
      data.isBillable !== undefined,
    { message: 'At least one field must be provided.' }
  );

export type CreateActivityStatusInput = z.infer<typeof createActivityStatusSchema>;
export type UpdateActivityStatusInput = z.infer<typeof updateActivityStatusSchema>;
