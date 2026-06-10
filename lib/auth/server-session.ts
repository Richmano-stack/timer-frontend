import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isAdminRole } from '@/lib/organization/roles';

export { isAdminRole };

export async function getServerSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getActiveMemberRole() {
  return auth.api.getActiveMemberRole({ headers: await headers() });
}

export async function listUserOrganizations() {
  return auth.api.listOrganizations({ headers: await headers() });
}

export async function setActiveOrganization(organizationId: string) {
  return auth.api.setActiveOrganization({
    body: { organizationId },
    headers: await headers(),
  });
}

