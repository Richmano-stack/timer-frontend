import { z } from 'zod';

export const clockInBodySchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  clockInIp: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  notes: z.string().optional(),
});

export const clockOutBodySchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  clockOutIp: z.string().optional().nullable(),
});

export const breakBodySchema = z
  .object({
    userId: z.string().uuid(),
    companyId: z.string().uuid(),
    timeLogId: z.string().uuid(),
    action: z.enum(['START', 'END']),
    statusId: z.string().uuid().optional(),
    statusName: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'START' && !value.statusId && !value.statusName) {
      ctx.addIssue({
        code: 'custom',
        message: 'statusId or statusName is required when action is START',
        path: ['statusId'],
      });
    }
  });

export const activeSessionQuerySchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
});

export const myDayQuerySchema = z.object({
  userId: z.string().uuid(),
  companyId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional(),
});

export const setStatusBodySchema = z
  .object({
    userId: z.string().uuid(),
    companyId: z.string().uuid(),
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

export type ClockInBody = z.infer<typeof clockInBodySchema>;
export type ClockOutBody = z.infer<typeof clockOutBodySchema>;
export type BreakBody = z.infer<typeof breakBodySchema>;
export type ActiveSessionQuery = z.infer<typeof activeSessionQuerySchema>;
export type MyDayQuery = z.infer<typeof myDayQuerySchema>;
export type SetStatusBody = z.infer<typeof setStatusBodySchema>;
