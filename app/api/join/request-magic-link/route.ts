import { JoinErrorCodes } from '@/lib/errors/join';
import { fail } from '@/lib/http/api-handler';
import { requestMagicLinkSchema } from '@/lib/validators/join';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestMagicLinkSchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      JoinErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return fail(
    JoinErrorCodes.INVITATION_REQUIRED,
    'Open organization join links are no longer supported. Use an invitation link from your administrator.',
    410
  );
}
