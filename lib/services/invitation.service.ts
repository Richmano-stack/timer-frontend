import { auditInvitationSent } from '@/lib/db/audit';
import { prisma } from '@/lib/db/prisma';
import { sendInvitationEmail } from '@/lib/email/send';
import { InvitationErrorCodes } from '@/lib/errors/invitation';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  canAssignRole,
  OrganizationRole,
} from '@/lib/organization/roles';
import { ServiceResult } from '@/lib/types/api-response';

function buildInvitationJoinUrl(invitationId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/join/invite/${invitationId}`;
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface InvitationDto {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export async function createInvitationForAdmin(
  organizationId: string,
  inviterId: string,
  actorRole: string,
  email: string,
  role: OrganizationRole
): Promise<ServiceResult<InvitationDto>> {
  if (!canAssignRole(actorRole, role)) {
    return fail(TimeTrackingErrorCodes.FORBIDDEN, 'You cannot assign that role.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId,
      user: { email: normalizedEmail },
    },
    select: { id: true },
  });

  if (existingMember) {
    return fail(
      InvitationErrorCodes.ALREADY_MEMBER,
      'This email already belongs to a member of the organization.'
    );
  }

  const pendingInvitation = await prisma.invitation.findFirst({
    where: {
      organizationId,
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (pendingInvitation) {
    return fail(
      InvitationErrorCodes.INVITATION_ALREADY_PENDING,
      'A pending invitation already exists for this email.'
    );
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const [organization, inviter] = await Promise.all([
    prisma.organization.findFirst({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.user.findFirst({
      where: { id: inviterId },
      select: { name: true },
    }),
  ]);

  const orgName = organization?.name ?? 'your organization';

  const invitation = await prisma.invitation.create({
    data: {
      id: crypto.randomUUID(),
      organizationId,
      email: normalizedEmail,
      role,
      status: 'pending',
      expiresAt,
      inviterId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  void auditInvitationSent({
    organizationId,
    actorUserId: inviterId,
    invitationId: invitation.id,
    metadata: {
      email: invitation.email,
      role: invitation.role,
    },
  });

  try {
    await sendInvitationEmail(invitation.email, {
      url: buildInvitationJoinUrl(invitation.id),
      orgName,
      inviterName: inviter?.name ?? undefined,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('[invitation] Failed to send invitation email', {
      organizationId,
      invitationId: invitation.id,
      to: invitation.email,
      error,
    });
  }

  return {
    success: true,
    data: toInvitationDto(invitation),
  };
}

function toInvitationDto(invitation: {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
}): InvitationDto {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

export async function listPendingInvitationsForAdmin(
  organizationId: string
): Promise<ServiceResult<InvitationDto[]>> {
  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return {
    success: true,
    data: invitations.map(toInvitationDto),
  };
}

export async function revokeInvitationForAdmin(
  organizationId: string,
  invitationId: string,
  actorRole: string
): Promise<ServiceResult<InvitationDto>> {
  void actorRole;
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      organizationId,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  if (!invitation) {
    return fail(
      InvitationErrorCodes.INVITATION_NOT_FOUND,
      'Invitation not found.'
    );
  }

  if (invitation.status !== 'pending') {
    return fail(
      InvitationErrorCodes.INVITATION_NOT_REVOCABLE,
      'This invitation has already been accepted or revoked.'
    );
  }

  const revoked = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'revoked' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return {
    success: true,
    data: toInvitationDto(revoked),
  };
}
