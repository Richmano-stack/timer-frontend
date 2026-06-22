import { NextResponse } from 'next/server';
import { isAPIError } from 'better-auth/api';
import { auth } from '@/lib/auth';
import { AuthErrorCodes } from '@/lib/errors/auth';
import { fail } from '@/lib/http/api-handler';
import { invalidJsonResponse, parseJsonBody } from '@/lib/http/session-route';
import {
  assertRegistrationAllowed,
  registrationDeniedResult,
} from '@/lib/auth/registration-policy';
import { grantRegistrationPermit } from '@/lib/auth/registration-permit';
import { registerSchema } from '@/lib/validators/auth';

const AUTH_ERROR_STATUS: Record<string, number> = {
  [AuthErrorCodes.REGISTRATION_NOT_ALLOWED]: 403,
  [AuthErrorCodes.INVITATION_REQUIRED]: 400,
  [AuthErrorCodes.INVITATION_INVALID]: 403,
  [AuthErrorCodes.VALIDATION_ERROR]: 400,
  [AuthErrorCodes.INTERNAL_SERVER_ERROR]: 500,
};

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return invalidJsonResponse();
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        AuthErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const { name, email, password, intent } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const invitationToken =
      parsed.data.intent === 'invitation' ? parsed.data.invitationToken : undefined;

    const policyResult = await assertRegistrationAllowed(
      normalizedEmail,
      intent,
      invitationToken
    );

    if (!policyResult.success) {
      const status = AUTH_ERROR_STATUS[policyResult.error.code] ?? 400;
      return fail(policyResult.error.code, policyResult.error.message, status);
    }

    grantRegistrationPermit(
      normalizedEmail,
      intent === 'owner_bootstrap' ? 'owner_bootstrap' : 'invitation'
    );

    const signUpResponse = await auth.api.signUpEmail({
      body: {
        name: name.trim(),
        email: normalizedEmail,
        password,
      },
      headers: request.headers,
      asResponse: true,
    });

    if (!signUpResponse.ok) {
      const errorBody = (await signUpResponse.json().catch(() => null)) as
        | { message?: string }
        | null;

      return fail(
        AuthErrorCodes.REGISTRATION_NOT_ALLOWED,
        errorBody?.message ?? registrationDeniedResult().error.message,
        signUpResponse.status
      );
    }

    const signUpBody = (await signUpResponse.json()) as {
      token: string | null;
      user: { id: string; email: string; name: string };
    };

    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: signUpBody.user,
          token: signUpBody.token,
        },
      },
      { status: 200 }
    );

    for (const cookie of signUpResponse.headers.getSetCookie()) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error) {
    if (isAPIError(error)) {
      return fail(
        AuthErrorCodes.REGISTRATION_NOT_ALLOWED,
        error.message,
        error.status
      );
    }

    console.error('[API] register error:', error);
    return fail(
      AuthErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to create account. Please try again later.',
      500
    );
  }
}
