import { z } from 'zod';

export const requestMagicLinkSchema = z.object({
  email: z.email('A valid email address is required.'),
  orgSlug: z
    .string()
    .min(1, 'Organization slug is required.')
    .max(120, 'Organization slug is too long.'),
});

export const updateJoinSettingsSchema = z.object({
  allowedDomains: z
    .array(z.string().min(1).max(253))
    .min(1, 'At least one allowed domain is required.')
    .max(20, 'No more than 20 domains are allowed.'),
});
