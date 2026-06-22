import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Onboarding',
};
import { OnboardingWizard } from './_components/onboarding-wizard';
import {
  getActiveMemberRole,
  getServerSession,
  isAdminRole,
  listUserOrganizations,
  setActiveOrganization,
} from '@/lib/auth/server-session';

export default async function OnboardingPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login?next=/onboarding');
  }

  const organizations = await listUserOrganizations();

  if (organizations && organizations.length > 0) {
    if (!session.session.activeOrganizationId) {
      await setActiveOrganization(organizations[0].id);
    }

    const { role } = await getActiveMemberRole();
    if (isAdminRole(role)) {
      redirect('/admin/overview');
    }
    redirect('/employee/track');
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <OnboardingWizard ownerEmail={session.user.email} />
      </div>
    </div>
  );
}
