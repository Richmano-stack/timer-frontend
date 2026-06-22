import { auth } from '@/lib/auth';
import { JoinErrorCodes } from '@/lib/errors/join';
import { fail, ok } from '@/lib/http/api-handler';
import { submitJoinRequest } from '@/lib/services/join-request.service';
import { submitJoinRequestSchema } from '@/lib/validators/join';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = submitJoinRequestSchema.safeParse(body);

    if (!parsed.success) {
      return fail(
        JoinErrorCodes.VALIDATION_ERROR,
        parsed.error.issues.map((issue) => issue.message).join('; ')
      );
    }

    const { orgSlug } = parsed.data;
    const session = await auth.api.getSession({ headers: request.headers });
    const sessionEmail = session?.user?.email?.trim().toLowerCase();

    let email = parsed.data.email?.trim().toLowerCase();

    if (sessionEmail) {
      if (email && email !== sessionEmail) {
        return fail(
          JoinErrorCodes.VALIDATION_ERROR,
          'Email must match your signed-in account.'
        );
      }
      email = sessionEmail;
    }

    if (!email) {
      return fail(
        JoinErrorCodes.VALIDATION_ERROR,
        'A valid email address is required.'
      );
    }

    const result = await submitJoinRequest(orgSlug, email, session?.user?.id);
    if (!result.success) {
      return fail(result.error.code, result.error.message);
    }

    return ok(result.data);
  } catch (error) {
    console.error('[API] join/request error:', error);
    return fail(
      JoinErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to submit join request. Please try again later.',
      500
    );
  }
}
