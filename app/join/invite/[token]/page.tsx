import type { Metadata } from 'next';
import { InviteJoinError } from '@/app/join/invite/[token]/_components/InviteJoinError';
import { InviteJoinForm } from '@/app/join/invite/[token]/_components/InviteJoinForm';
import { JoinErrorCodes } from '@/lib/errors/join';
import { getInvitationByToken } from '@/lib/services/join.service';
import { inviteTokenSchema } from '@/lib/validators/join';

export const metadata: Metadata = {
  title: 'Accept Invitation',
};

interface InviteJoinPageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}

function resolveInviteError(
  error: string | undefined,
  message: string | undefined
): string | null {
  if (message) {
    try {
      return decodeURIComponent(message);
    } catch {
      return message;
    }
  }

  if (error === 'auth_failed') {
    return 'Sign-in link is invalid or expired. Request a new link below.';
  }

  if (error === 'oauth') {
    return 'Google sign-in failed. Try again or use the email magic link below.';
  }

  return null;
}

function invitationErrorTitle(code: string): string {
  switch (code) {
    case JoinErrorCodes.INVITATION_EXPIRED:
      return 'Invitation expired';
    case JoinErrorCodes.INVITATION_NOT_PENDING:
      return 'Invitation unavailable';
    case JoinErrorCodes.INVITATION_NOT_FOUND:
    default:
      return 'Invalid invitation';
  }
}

export default async function InviteJoinPage({ params, searchParams }: InviteJoinPageProps) {
  const { token } = await params;
  const { error, message } = await searchParams;

  const tokenParsed = inviteTokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    return (
      <InviteJoinError
        title="Invalid invitation"
        message="This invitation link is malformed. Check the link from your email and try again."
      />
    );
  }

  const invitationResult = await getInvitationByToken(tokenParsed.data);
  if (!invitationResult.success) {
    return (
      <InviteJoinError
        title={invitationErrorTitle(invitationResult.error.code)}
        message={invitationResult.error.message}
      />
    );
  }

  const invitation = invitationResult.data;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <InviteJoinForm
          token={invitation.id}
          orgName={invitation.organizationName}
          maskedEmail={invitation.maskedEmail}
          initialError={resolveInviteError(error, message)}
        />
      </div>
    </div>
  );
}
