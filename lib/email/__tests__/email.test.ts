import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractPrimaryLinkFromHtml,
  invitationEmail,
  magicLinkEmail,
  resetPasswordEmail,
} from '@/lib/email/templates';

describe('email templates', () => {
  it('renders a magic link email with optional org name', () => {
    const html = magicLinkEmail({
      url: 'https://app.example.com/auth/verify?token=abc',
      orgName: 'Acme Corp',
    });

    expect(html).toContain('Join Acme Corp');
    expect(html).toContain('https://app.example.com/auth/verify?token=abc');
    expect(html).toContain('Join team');
    expect(html).not.toContain('<script');
  });

  it('renders a magic link email without org name', () => {
    const html = magicLinkEmail({
      url: 'https://app.example.com/auth/verify?token=abc',
    });

    expect(html).toContain('Sign in to your account');
    expect(html).toContain('Sign in');
  });

  it('escapes HTML in invitation content', () => {
    const html = invitationEmail({
      url: 'https://app.example.com/join/invite/token',
      orgName: 'Acme <script>alert(1)</script>',
      inviterName: 'Jane "Admin" O&#39;Malley',
      expiresAt: '2026-06-17T12:00:00.000Z',
    });

    expect(html).toContain('Acme &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Jane &quot;Admin&quot; O&amp;#39;Malley');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('includes invitation expiry and CTA link', () => {
    const html = invitationEmail({
      url: 'https://app.example.com/join/invite/abc-123',
      orgName: 'Demo Company',
      inviterName: 'Owner User',
      expiresAt: new Date('2026-06-17T12:00:00.000Z'),
    });

    expect(html).toContain('Accept invitation');
    expect(html).toContain('https://app.example.com/join/invite/abc-123');
    expect(html).toContain('June 17, 2026');
  });

  it('renders a reset password email', () => {
    const html = resetPasswordEmail({
      url: 'https://app.example.com/api/auth/reset-password/token?callbackURL=...',
    });

    expect(html).toContain('Reset your password');
    expect(html).toContain('https://app.example.com/api/auth/reset-password/token');
  });

  it('extracts the primary CTA link from rendered HTML', () => {
    const html = magicLinkEmail({
      url: 'https://app.example.com/auth/verify?token=abc',
    });

    expect(extractPrimaryLinkFromHtml(html)).toBe(
      'https://app.example.com/auth/verify?token=abc'
    );
  });
});

describe('sendMagicLinkEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_PROVIDER;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs a dev stub when no provider API key is configured', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { sendMagicLinkEmail } = await import('@/lib/email/send');

    const html = magicLinkEmail({ url: 'https://app.example.com/auth/verify?token=abc' });

    await sendMagicLinkEmail('user@example.com', 'Sign in', html);

    expect(fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[email] Dev stub — magic-link (no API key configured)',
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Sign in',
        url: 'https://app.example.com/auth/verify?token=abc',
      })
    );
  });

  it('does not log magic link URLs in production when unconfigured', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    const { sendMagicLinkEmail } = await import('@/lib/email/send');

    const html = magicLinkEmail({ url: 'https://app.example.com/auth/verify?token=secret' });

    await sendMagicLinkEmail('user@example.com', 'Sign in', html);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[email] magic-link delivery skipped — email provider not configured',
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Sign in',
      })
    );
    expect(consoleSpy.mock.calls[0]?.[1]).not.toHaveProperty('url');
  });

  it('sends via Resend when RESEND_API_KEY and EMAIL_FROM are set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'OmniShift <noreply@example.com>';
    process.env.EMAIL_PROVIDER = 'resend';

    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const { sendMagicLinkEmail } = await import('@/lib/email/send');
    const html = magicLinkEmail({ url: 'https://app.example.com/auth/verify?token=abc' });

    await sendMagicLinkEmail('user@example.com', 'Sign in', html);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
        }),
      })
    );

    const requestInit = vi.mocked(fetch).mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body));

    expect(body).toEqual({
      from: 'OmniShift <noreply@example.com>',
      to: ['user@example.com'],
      subject: 'Sign in',
      html,
    });
  });

  it('throws when the provider API returns an error', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'noreply@example.com';

    vi.mocked(fetch).mockResolvedValue(
      new Response('invalid from address', { status: 422, statusText: 'Unprocessable Entity' })
    );

    const { sendMagicLinkEmail } = await import('@/lib/email/send');
    const html = magicLinkEmail({ url: 'https://app.example.com/auth/verify?token=abc' });

    await expect(sendMagicLinkEmail('user@example.com', 'Sign in', html)).rejects.toThrow(
      /Resend API error \(422\)/
    );
  });
});

describe('sendInvitationEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('builds invitation content and sends via configured provider', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'noreply@example.com';

    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const { sendInvitationEmail } = await import('@/lib/email/send');

    await sendInvitationEmail('invitee@example.com', {
      url: 'https://app.example.com/join/invite/token-1',
      orgName: 'Demo Company',
      inviterName: 'Admin User',
      expiresAt: '2026-06-17T12:00:00.000Z',
    });

    expect(fetch).toHaveBeenCalledOnce();
    const requestInit = vi.mocked(fetch).mock.calls[0]?.[1];
    const body = JSON.parse(String(requestInit?.body));

    expect(body.subject).toBe("You're invited to join Demo Company on OmniShift");
    expect(body.to).toEqual(['invitee@example.com']);
    expect(body.html).toContain('Demo Company');
    expect(body.html).toContain('https://app.example.com/join/invite/token-1');
  });
});

describe('sendResetPasswordEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('logs a dev stub when no provider API key is configured', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { sendResetPasswordEmail } = await import('@/lib/email/send');

    await sendResetPasswordEmail(
      'user@example.com',
      'https://app.example.com/api/auth/reset-password/abc'
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith(
      '[email] Dev stub — reset-password (no API key configured)',
      expect.objectContaining({
        to: 'user@example.com',
        url: 'https://app.example.com/api/auth/reset-password/abc',
      })
    );
  });

  it('sends via Resend when RESEND_API_KEY and EMAIL_FROM are set', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = 'noreply@example.com';

    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    const { sendResetPasswordEmail } = await import('@/lib/email/send');

    await sendResetPasswordEmail(
      'user@example.com',
      'https://app.example.com/api/auth/reset-password/abc'
    );

    expect(fetch).toHaveBeenCalledOnce();
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.subject).toBe('Reset your OmniShift password');
    expect(body.html).toContain('Reset password');
  });
});
