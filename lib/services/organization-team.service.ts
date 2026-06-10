import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  canAssignRole,
  canEditMemberRole,
  OrganizationRole,
} from '@/lib/organization/roles';
import { ServiceResult } from '@/lib/types/api-response';

export interface TeamMemberDto {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TeamResponse {
  id: string;
  name: string;
  slug: string;
  actorRole: string;
  members: TeamMemberDto[];
}

export interface UpdateMemberRoleResult {
  memberId: string;
  role: string;
}

export async function getTeamForAdmin(
  organizationId: string,
  actorRole: string
): Promise<ServiceResult<TeamResponse>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  return {
    success: true,
    data: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      actorRole,
      members: organization.members.map((member) => ({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt.toISOString(),
        user: member.user,
      })),
    },
  };
}

export async function updateMemberRoleForAdmin(
  organizationId: string,
  actorRole: string,
  memberId: string,
  newRole: OrganizationRole
): Promise<ServiceResult<UpdateMemberRoleResult>> {
  if (!canAssignRole(actorRole, newRole)) {
    return fail(TimeTrackingErrorCodes.FORBIDDEN, 'You cannot assign that role.');
  }

  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      organizationId,
    },
    select: {
      id: true,
      role: true,
      userId: true,
    },
  });

  if (!member) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Member not found in organization.');
  }

  if (!canEditMemberRole(actorRole, member.role)) {
    return fail(TimeTrackingErrorCodes.FORBIDDEN, 'You cannot change this member\'s role.');
  }

  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { role: newRole },
    select: { id: true, role: true },
  });

  return {
    success: true,
    data: {
      memberId: updated.id,
      role: updated.role,
    },
  };
}
