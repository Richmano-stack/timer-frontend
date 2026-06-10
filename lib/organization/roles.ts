export type OrganizationRole = 'owner' | 'admin' | 'member';

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member (Agent)',
};

const ADMIN_ASSIGNABLE_ROLES: OrganizationRole[] = ['member', 'admin'];
const OWNER_ASSIGNABLE_ROLES: OrganizationRole[] = ['member', 'admin'];

export function primaryRole(role: string): OrganizationRole {
  const first = role.split(',')[0]?.trim().toLowerCase();
  if (first === 'owner' || first === 'admin' || first === 'member') {
    return first;
  }
  return 'member';
}

export function formatRoleLabel(role: string): string {
  return ROLE_LABELS[primaryRole(role)] ?? role;
}

export function assignableRolesForActor(actorRole: string): OrganizationRole[] {
  const actor = primaryRole(actorRole);
  if (actor === 'owner') return OWNER_ASSIGNABLE_ROLES;
  if (actor === 'admin') return ADMIN_ASSIGNABLE_ROLES;
  return [];
}

export function isAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  const primary = primaryRole(role);
  return primary === 'owner' || primary === 'admin';
}

export function canAssignRole(actorRole: string, newRole: OrganizationRole): boolean {
  return assignableRolesForActor(actorRole).includes(newRole);
}

export function canEditMemberRole(actorRole: string, targetRole: string): boolean {
  const actor = primaryRole(actorRole);
  const target = primaryRole(targetRole);

  if (actor !== 'owner' && actor !== 'admin') return false;
  if (target === 'owner') return false;
  if (actor === 'admin' && target === 'admin') return false;

  return true;
}
