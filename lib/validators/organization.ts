import { z } from 'zod';

export const updateMemberRoleSchema = z.object({
  role: z.enum(['member', 'admin'], {
    error: 'Role must be member or admin.',
  }),
});
