import { BRAND_NAME } from '@/lib/constants/brand';
import {
  extractPrimaryLinkFromHtml,
  invitationEmail,
  type InvitationEmailParams,
  resetPasswordEmail,
} from '@/lib/email/templates';

type EmailProvider = 'resend' | 'postmark' | 'sendgrid';

interface EmailRuntimeConfig {
  provider: EmailProvider;
  from: string;
  resendApiKey: string;
  postmarkServerToken: string;
  sendgridApiKey: string;
}

function readEmailRuntimeConfig(): EmailRuntimeConfig {
  const provider = (process.env.EMAIL_PROVIDER ?? 'resend') as EmailProvider;

  return {
    provider,
    from: process.env.EMAIL_FROM?.trim() ?? '',
    resendApiKey: process.env.RESEND_API_KEY?.trim() ?? '',
    postmarkServerToken: process.env.POSTMARK_SERVER_TOKEN?.trim() ?? '',
    sendgridApiKey: process.env.SENDGRID_API_KEY?.trim() ?? '',
  };
}

function getProviderApiKey(config: EmailRuntimeConfig): string {
  switch (config.provider) {
    case 'postmark':
      return config.postmarkServerToken;
    case 'sendgrid':
      return config.sendgridApiKey;
    case 'resend':
    default:
      return config.resendApiKey;
  }
}

export function isEmailDeliveryConfigured(config = readEmailRuntimeConfig()): boolean {
  return Boolean(getProviderApiKey(config) && config.from);
}

async function sendViaResend(
  config: EmailRuntimeConfig,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Resend API error (${response.status}): ${detail}`);
  }
}

async function sendViaPostmark(
  config: EmailRuntimeConfig,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': config.postmarkServerToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      From: config.from,
      To: to,
      Subject: subject,
      HtmlBody: html,
      MessageStream: 'outbound',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Postmark API error (${response.status}): ${detail}`);
  }
}

function parseFromAddress(from: string): { email: string; name?: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: from.trim() };
}

async function sendViaSendGrid(
  config: EmailRuntimeConfig,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const from = parseFromAddress(config.from);
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`SendGrid API error (${response.status}): ${detail}`);
  }
}

async function deliverEmail(to: string, subject: string, html: string): Promise<void> {
  const config = readEmailRuntimeConfig();

  if (!isEmailDeliveryConfigured(config)) {
    logDevEmailStub({ to, subject, html, kind: 'transactional' });
    return;
  }

  switch (config.provider) {
    case 'postmark':
      await sendViaPostmark(config, to, subject, html);
      break;
    case 'sendgrid':
      await sendViaSendGrid(config, to, subject, html);
      break;
    case 'resend':
    default:
      await sendViaResend(config, to, subject, html);
      break;
  }
}

function logDevEmailStub(options: {
  to: string;
  subject: string;
  html: string;
  kind: 'magic-link' | 'invitation' | 'transactional' | 'reset-password';
}): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const url = extractPrimaryLinkFromHtml(options.html);

  if (isProduction) {
    console.info(`[email] ${options.kind} delivery skipped — email provider not configured`, {
      to: options.to,
      subject: options.subject,
    });
    return;
  }

  console.info(`[email] Dev stub — ${options.kind} (no API key configured)`, {
    to: options.to,
    subject: options.subject,
    ...(url ? { url } : {}),
  });
}

export async function sendMagicLinkEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const config = readEmailRuntimeConfig();

  if (!isEmailDeliveryConfigured(config)) {
    logDevEmailStub({ to, subject, html, kind: 'magic-link' });
    return;
  }

  await deliverEmail(to, subject, html);
}

export async function sendInvitationEmail(
  to: string,
  params: InvitationEmailParams
): Promise<void> {
  const subject = `You're invited to join ${params.orgName} on ${BRAND_NAME}`;
  const html = invitationEmail(params);
  const config = readEmailRuntimeConfig();

  if (!isEmailDeliveryConfigured(config)) {
    logDevEmailStub({ to, subject, html, kind: 'invitation' });
    return;
  }

  await deliverEmail(to, subject, html);
}

export async function sendResetPasswordEmail(
  to: string,
  url: string
): Promise<void> {
  const subject = `Reset your ${BRAND_NAME} password`;
  const html = resetPasswordEmail({ url });
  const config = readEmailRuntimeConfig();

  if (!isEmailDeliveryConfigured(config)) {
    logDevEmailStub({ to, subject, html, kind: 'reset-password' });
    return;
  }

  await deliverEmail(to, subject, html);
}

export { readEmailRuntimeConfig };
