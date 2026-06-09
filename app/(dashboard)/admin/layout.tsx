import { redirect } from 'next/navigation';
import {
  getActiveMemberRole,
  getServerSession,
} from '@/lib/auth/server-session';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login?next=/admin/overview');
  }

  if (!session.session.activeOrganizationId) {
    redirect('/onboarding');
  }

  const { role } = await getActiveMemberRole();

  if (role === 'member') {
    redirect('/employee/track');
  }

  return <>{children}</>;
}
