import { redirect } from 'next/navigation';
import { SignupForm } from '@/components/signup-form';
import { resolveInvitationToken } from '@/lib/invitations/resolve-invitation-token';

interface RegisterPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { token } = await searchParams;
  let invitation = null;

  if (token) {
    invitation = await resolveInvitationToken(token);
    if (!invitation) {
      redirect('/login?error=invalid_invite');
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm invitation={invitation} inviteToken={token} />
      </div>
    </div>
  );
}
