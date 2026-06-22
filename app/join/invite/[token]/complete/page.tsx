import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  completeInvitationJoin,
  getInvitationOrganizationId,
} from '@/lib/services/join.service';
import { inviteTokenSchema } from '@/lib/validators/join';

interface InviteJoinCompletePageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteJoinCompletePage({ params }: InviteJoinCompletePageProps) {
  const { token } = await params;
  const tokenParsed = inviteTokenSchema.safeParse(token);

  if (!tokenParsed.success) {
    redirect('/login');
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect(`/join/invite/${tokenParsed.data}?error=auth_failed`);
  }

  const joinResult = await completeInvitationJoin(
    tokenParsed.data,
    session.user.id,
    session.user.email
  );

  if (!joinResult.success) {
    if (joinResult.error.code === 'ALREADY_MEMBER') {
      const organizationId = await getInvitationOrganizationId(tokenParsed.data);

      if (organizationId) {
        await auth.api.setActiveOrganization({
          body: { organizationId },
          headers: requestHeaders,
        });
      }

      redirect('/employee/track');
    }

    const message = encodeURIComponent(joinResult.error.message);
    redirect(
      `/join/invite/${tokenParsed.data}?error=${joinResult.error.code}&message=${message}`
    );
  }

  await auth.api.setActiveOrganization({
    body: { organizationId: joinResult.data.organizationId },
    headers: requestHeaders,
  });

  redirect('/employee/track');
}
