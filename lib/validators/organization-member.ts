import { z } from 'zod';

export const updateMemberStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DEACTIVATED'], {
    error: 'Status must be ACTIVE or DEACTIVATED.',
  }),
});

export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;
