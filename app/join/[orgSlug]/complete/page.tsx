import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  completeJoinWithApprovedRequest,
  getOrganizationBySlug,
} from '@/lib/services/join.service';

interface JoinCompletePageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function JoinCompletePage({ params }: JoinCompletePageProps) {
  const { orgSlug } = await params;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect(`/join/${orgSlug}?error=auth_failed`);
  }

  const orgResult = await getOrganizationBySlug(orgSlug);
  if (!orgResult.success) {
    redirect(`/join/${orgSlug}`);
  }

  const joinResult = await completeJoinWithApprovedRequest(
    orgResult.data.id,
    session.user.id,
    session.user.email
  );

  if (!joinResult.success) {
    if (joinResult.error.code === 'ALREADY_MEMBER') {
      await auth.api.setActiveOrganization({
        body: { organizationId: orgResult.data.id },
        headers: requestHeaders,
      });
      redirect('/employee/track');
    }

    const message = encodeURIComponent(joinResult.error.message);
    redirect(`/join/${orgSlug}?error=${joinResult.error.code}&message=${message}`);
  }

  await auth.api.setActiveOrganization({
    body: { organizationId: joinResult.data.organizationId },
    headers: requestHeaders,
  });

  redirect('/employee/track');
}
