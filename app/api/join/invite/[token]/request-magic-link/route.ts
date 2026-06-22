import { auth } from '@/lib/auth';
import { JoinErrorCodes } from '@/lib/errors/join';
import { fail, ok } from '@/lib/http/api-handler';
import { checkJoinMagicLinkRateLimit, formatJoinMagicLinkRateLimitMessage } from '@/lib/security/join-rate-limit';
import { validateInvitationForJoin } from '@/lib/services/join.service';
import { inviteRequestMagicLinkSchema, inviteTokenSchema } from '@/lib/validators/join';

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const tokenParsed = inviteTokenSchema.safeParse(token);

    if (!tokenParsed.success) {
      return fail(
        JoinErrorCodes.VALIDATION_ERROR,
        tokenParsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = inviteRequestMagicLinkSchema.safeParse(body);

    if (!parsed.success) {
      return fail(
        JoinErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    const rateLimit = checkJoinMagicLinkRateLimit(request, normalizedEmail);
    if (!rateLimit.allowed) {
      return fail(
        JoinErrorCodes.RATE_LIMITED,
        formatJoinMagicLinkRateLimitMessage(rateLimit),
        429
      );
    }

    const validation = await validateInvitationForJoin(tokenParsed.data, normalizedEmail);
    if (!validation.success) {
      return fail(validation.error.code, validation.error.message);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const callbackURL = `${baseUrl}/join/invite/${tokenParsed.data}/complete`;
    const errorCallbackURL = `${baseUrl}/join/invite/${tokenParsed.data}?error=auth_failed`;

    await auth.api.signInMagicLink({
      body: {
        email: normalizedEmail,
        callbackURL,
        newUserCallbackURL: callbackURL,
        errorCallbackURL,
        metadata: {
          invitationToken: tokenParsed.data,
          orgSlug: validation.data.organizationSlug,
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
    console.error('[API] invite request-magic-link error:', error);
    return fail(
      JoinErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to send magic link. Please try again later.',
      500
    );
  }
}
