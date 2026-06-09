import { z } from 'zod';

export const clockInBodySchema = z.object({
  notes: z.string().optional(),
});

export const setStatusBodySchema = z
  .object({
    statusId: z.string().uuid().optional(),
    statusName: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.statusId && value.statusName) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide statusId or statusName, not both',
        path: ['statusId'],
      });
    }
  });

export const myDayQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
  userId: z.string().optional(),
});

export type ClockInBody = z.infer<typeof clockInBodySchema>;
export type SetStatusBody = z.infer<typeof setStatusBodySchema>;
export type MyDayQuery = z.infer<typeof myDayQuerySchema>;
