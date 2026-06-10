import { auth } from '@/lib/auth';
import { JoinErrorCodes } from '@/lib/errors/join';
import { fail, ok } from '@/lib/http/api-handler';
import { checkJoinMagicLinkRateLimit } from '@/lib/security/join-rate-limit';
import { validateJoinEmail } from '@/lib/services/join.service';
import { requestMagicLinkSchema } from '@/lib/validators/join';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = requestMagicLinkSchema.safeParse(body);

    if (!parsed.success) {
      return fail(
        JoinErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const { email, orgSlug } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const rateLimit = checkJoinMagicLinkRateLimit(request, normalizedEmail);
    if (!rateLimit.allowed) {
      const retryAfterSeconds = Math.ceil(rateLimit.retryAfterMs / 1000);
      const scopeLabel = rateLimit.scope === 'ip' ? 'this IP address' : 'this email address';
      return fail(
        JoinErrorCodes.RATE_LIMITED,
        `Too many join attempts from ${scopeLabel}. Try again in ${retryAfterSeconds} seconds.`,
        429
      );
    }

    const validation = await validateJoinEmail(orgSlug, normalizedEmail);
    if (!validation.success) {
      return fail(validation.error.code, validation.error.message);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const callbackURL = `${baseUrl}/join/${orgSlug}/complete`;
    const errorCallbackURL = `${baseUrl}/join/${orgSlug}?error=auth_failed`;

    await auth.api.signInMagicLink({
      body: {
        email: normalizedEmail,
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL,
        metadata: {
          orgSlug,
          organizationId: validation.data.organizationId,
        },
      },
      headers: request.headers,
    });

    return ok({
      message: 'Magic link sent. Check your inbox to continue joining the team.',
      organizationName: validation.data.organizationName,
    });
  } catch (error) {
    console.error('[API] request-magic-link error:', error);
    return fail(
      JoinErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to send magic link. Please try again later.',
      500
    );
  }
}
