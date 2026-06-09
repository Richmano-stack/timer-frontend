import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

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

export function isAdminRole(role: string | undefined | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function redirectPathForRole(role: string | undefined | null): string {
  if (isAdminRole(role)) {
    return '/admin/overview';
  }
  return '/employee/track';
}
