import { z } from 'zod';

const requiredEnvString = (name: string) =>
  z.string({ error: `${name} is required.` }).min(1, `${name} is required.`);

const requiredEnvUrl = (name: string) =>
  requiredEnvString(name).pipe(z.url(`${name} must be a valid URL.`));

const isProduction = process.env.NODE_ENV === 'production';

const emailProviderSchema = z.enum(['resend', 'postmark', 'sendgrid']);

const envSchema = z
  .object({
    DATABASE_URL: requiredEnvString('DATABASE_URL'),
    BETTER_AUTH_SECRET: requiredEnvString('BETTER_AUTH_SECRET'),
    BETTER_AUTH_URL: requiredEnvUrl('BETTER_AUTH_URL'),
    NEXT_PUBLIC_APP_URL: requiredEnvUrl('NEXT_PUBLIC_APP_URL'),
    EMAIL_PROVIDER: emailProviderSchema.optional(),
    EMAIL_FROM: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    POSTMARK_SERVER_TOKEN: z.string().optional(),
    SENDGRID_API_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!isProduction) {
      return;
    }

    if (!data.EMAIL_FROM?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'EMAIL_FROM is required in production.',
        path: ['EMAIL_FROM'],
      });
    }

    const provider = data.EMAIL_PROVIDER ?? 'resend';

    if (provider === 'resend' && !data.RESEND_API_KEY?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'RESEND_API_KEY is required in production when EMAIL_PROVIDER is resend.',
        path: ['RESEND_API_KEY'],
      });
    }

    if (provider === 'postmark' && !data.POSTMARK_SERVER_TOKEN?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'POSTMARK_SERVER_TOKEN is required in production when EMAIL_PROVIDER is postmark.',
        path: ['POSTMARK_SERVER_TOKEN'],
      });
    }

    if (provider === 'sendgrid' && !data.SENDGRID_API_KEY?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'SENDGRID_API_KEY is required in production when EMAIL_PROVIDER is sendgrid.',
        path: ['SENDGRID_API_KEY'],
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Environment validation failed. Set required variables:\n${details}`);
}

export const env = parsed.data;

export const emailConfig = {
  provider: env.EMAIL_PROVIDER ?? ('resend' as const),
  from: env.EMAIL_FROM?.trim() ?? '',
  resendApiKey: env.RESEND_API_KEY?.trim() ?? '',
  postmarkServerToken: env.POSTMARK_SERVER_TOKEN?.trim() ?? '',
  sendgridApiKey: env.SENDGRID_API_KEY?.trim() ?? '',
};
