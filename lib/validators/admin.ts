import { z } from 'zod';

export const companyIdQuerySchema = z.object({
  companyId: z.string().uuid(),
});

export const timesheetsQuerySchema = z.object({
  companyId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
});

export const employeeHistoryQuerySchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
