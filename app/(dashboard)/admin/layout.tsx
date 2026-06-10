import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/layout/AdminShell';
import { prisma } from '@/lib/db/prisma';
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

  const organization = await prisma.organization.findUnique({
    where: { id: session.session.activeOrganizationId },
    select: { name: true },
  });

  return (
    <AdminShell organizationName={organization?.name}>{children}</AdminShell>
  );
}
