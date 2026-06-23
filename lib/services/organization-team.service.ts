import { MemberStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  canAssignRole,
  canEditMemberRole,
  canEditMemberStatus,
  primaryRole,
  OrganizationRole,
} from '@/lib/organization/roles';
import { ServiceResult } from '@/lib/types/api-response';

export interface TeamMemberDto {
  id: string;
  role: string;
  status: MemberStatus;
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

export interface UpdateMemberStatusResult {
  memberId: string;
  status: MemberStatus;
}

export async function checkMemberActive(
  userId: string,
  organizationId: string
): Promise<ServiceResult<{ userId: string; organizationId: string }>> {
  const member = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { status: true },
  });

  if (!member) {
    return fail(
      TimeTrackingErrorCodes.USER_NOT_IN_COMPANY,
      'User is not a member of the specified organization.'
    );
  }

  if (member.status === MemberStatus.DEACTIVATED) {
    return fail(
      TimeTrackingErrorCodes.MEMBER_DEACTIVATED,
      'This account has been deactivated and cannot perform time-tracking actions.'
    );
  }

  return { success: true, data: { userId, organizationId } };
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
          status: true,
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
        status: member.status,
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

export async function updateMemberStatusForAdmin(
  organizationId: string,
  actorRole: string,
  _actorUserId: string,
  memberId: string,
  status: MemberStatus
): Promise<ServiceResult<UpdateMemberStatusResult>> {
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      organizationId,
    },
    select: {
      id: true,
      role: true,
      userId: true,
      status: true,
    },
  });

  if (!member) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Member not found in organization.');
  }

  if (!canEditMemberStatus(actorRole, member.role)) {
    return fail(TimeTrackingErrorCodes.FORBIDDEN, 'You cannot change this member\'s status.');
  }

  if (member.status === status) {
    return {
      success: true,
      data: { memberId: member.id, status: member.status },
    };
  }

  if (status === MemberStatus.DEACTIVATED && primaryRole(member.role) === 'owner') {
    const activeOwnerCount = await prisma.member.count({
      where: {
        organizationId,
        status: MemberStatus.ACTIVE,
        role: 'owner',
      },
    });

    if (activeOwnerCount <= 1) {
      return fail(
        TimeTrackingErrorCodes.FORBIDDEN,
        'Cannot deactivate the last owner of the organization.'
      );
    }
  }

  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { status },
    select: { id: true, status: true },
  });

  return {
    success: true,
    data: {
      memberId: updated.id,
      status: updated.status,
    },
  };
}
