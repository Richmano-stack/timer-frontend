import { z } from 'zod';

export const companyIdQuerySchema = z.object({
  companyId: z.string().uuid(),
});

export const timesheetsQuerySchema = z.object({
  companyId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
});
