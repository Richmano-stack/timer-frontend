import { z } from 'zod';

export const ownerRegisterSchema = z.object({
  intent: z.literal('owner_bootstrap'),
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name is too long.'),
  email: z.email('A valid email address is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
});

export const invitationRegisterSchema = z.object({
  intent: z.literal('invitation'),
  invitationToken: z.string().trim().min(1, 'Invitation token is required.'),
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name is too long.'),
  email: z.email('A valid email address is required.'),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
});

export const registerSchema = z.discriminatedUnion('intent', [
  ownerRegisterSchema,
  invitationRegisterSchema,
]);

export type RegisterInput = z.infer<typeof registerSchema>;
