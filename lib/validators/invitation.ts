import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.email('A valid email address is required.'),
  role: z.enum(['member', 'admin'], {
    error: 'Role must be member or admin.',
  }),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
