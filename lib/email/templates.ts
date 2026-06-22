import { format } from 'date-fns';
import { BRAND_NAME } from '@/lib/constants/brand';

export interface MagicLinkEmailParams {
  url: string;
  orgName?: string;
}

export interface InvitationEmailParams {
  url: string;
  orgName: string;
  inviterName?: string;
  expiresAt: Date | string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatExpiresAt(expiresAt: Date | string): string {
  const date = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return format(date, "MMMM d, yyyy 'at' h:mm a 'UTC'");
}

function emailLayout(options: {
  preheader: string;
  headline: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerNote: string;
}): string {
  const { preheader, headline, bodyHtml, ctaLabel, ctaUrl, footerNote } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(headline)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 16px !important; }
      .button { display: block !important; width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">${escapeHtml(BRAND_NAME)}</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:#18181b;">${escapeHtml(headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;font-size:16px;line-height:1.6;color:#3f3f46;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <a class="button" href="${escapeHtml(ctaUrl)}" style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 24px;border-radius:8px;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px 32px;font-size:13px;line-height:1.5;color:#71717a;">
              <p style="margin:0 0 12px 0;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:0;word-break:break-all;"><a href="${escapeHtml(ctaUrl)}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(ctaUrl)}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.5;color:#71717a;">
              ${escapeHtml(footerNote)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function magicLinkEmail(params: MagicLinkEmailParams): string {
  const orgName = params.orgName?.trim();
  const headline = orgName ? `Join ${orgName}` : 'Sign in to your account';
  const preheader = orgName
    ? `Use this secure link to join ${orgName} on ${BRAND_NAME}.`
    : `Use this secure link to sign in to ${BRAND_NAME}.`;

  const bodyHtml = orgName
    ? `<p style="margin:0 0 16px 0;">You requested access to join <strong>${escapeHtml(orgName)}</strong> on ${escapeHtml(BRAND_NAME)}.</p>
       <p style="margin:0;">Click the button below to verify your email and continue. This link expires soon and can only be used once.</p>`
    : `<p style="margin:0 0 16px 0;">You requested a secure sign-in link for ${escapeHtml(BRAND_NAME)}.</p>
       <p style="margin:0;">Click the button below to continue. This link expires soon and can only be used once.</p>`;

  return emailLayout({
    preheader,
    headline,
    bodyHtml,
    ctaLabel: orgName ? 'Join team' : 'Sign in',
    ctaUrl: params.url,
    footerNote: `If you did not request this email, you can safely ignore it. Sent by ${BRAND_NAME}.`,
  });
}

export function invitationEmail(params: InvitationEmailParams): string {
  const orgName = params.orgName.trim();
  const inviterLine = params.inviterName?.trim()
    ? `<p style="margin:0 0 16px 0;"><strong>${escapeHtml(params.inviterName.trim())}</strong> invited you to join <strong>${escapeHtml(orgName)}</strong> on ${escapeHtml(BRAND_NAME)}.</p>`
    : `<p style="margin:0 0 16px 0;">You have been invited to join <strong>${escapeHtml(orgName)}</strong> on ${escapeHtml(BRAND_NAME)}.</p>`;

  const expiresLabel = formatExpiresAt(params.expiresAt);

  return emailLayout({
    preheader: `Accept your invitation to join ${orgName} on ${BRAND_NAME}.`,
    headline: `You're invited to ${orgName}`,
    bodyHtml: `${inviterLine}
      <p style="margin:0 0 16px 0;">Use the link below to accept your invitation and set up your account.</p>
      <p style="margin:0;">This invitation expires on <strong>${escapeHtml(expiresLabel)}</strong>.</p>`,
    ctaLabel: 'Accept invitation',
    ctaUrl: params.url,
    footerNote: `If you were not expecting this invitation, you can ignore this email. Sent by ${BRAND_NAME}.`,
  });
}

export function extractPrimaryLinkFromHtml(html: string): string | undefined {
  const match = html.match(/class="button"\s+href="([^"]+)"/);
  return match?.[1];
}
