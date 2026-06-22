import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { JoinErrorCodes } from '@/lib/errors/join';
import { fail as joinFail } from '@/lib/errors/join-service';
import {
  createDefaultJoinMetadata,
  emailMatchesAllowedDomains,
  parseOrganizationMetadata,
  serializeOrganizationMetadata,
  type OrganizationJoinMetadata,
} from '@/lib/organization/metadata';
import { ServiceResult } from '@/lib/types/api-response';

export interface JoinOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  allowedDomains: string[];
}

export interface JoinSettings {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  allowedDomains: string[];
  requireApproval: boolean;
  joinUrl: string;
}

export interface InvitationJoinSummary {
  id: string;
  email: string;
  maskedEmail: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  status: string;
  expiresAt: Date;
}

export function maskInvitationEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return '***@***';

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const visible = local.slice(0, 1);
  const hiddenLength = Math.max(local.length - 1, 1);

  return `${visible}${'*'.repeat(hiddenLength)}@${domain}`;
}

function normalizeJoinEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isInvitationExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

async function loadInvitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { id: token },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organizationId: true,
      organization: {
        select: { id: true, name: true, slug: true, metadata: true },
      },
    },
  });
}

export async function getInvitationOrganizationId(token: string): Promise<string | null> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: token },
    select: { organizationId: true },
  });

  return invitation?.organizationId ?? null;
}

export async function getInvitationByToken(
  token: string
): Promise<ServiceResult<InvitationJoinSummary>> {
  const invitation = await loadInvitationByToken(token);

  if (!invitation) {
    return joinFail(JoinErrorCodes.INVITATION_NOT_FOUND, 'This invitation link is invalid.');
  }

  if (invitation.status !== 'pending') {
    return joinFail(
      JoinErrorCodes.INVITATION_NOT_PENDING,
      'This invitation is no longer active.'
    );
  }

  if (isInvitationExpired(invitation.expiresAt)) {
    return joinFail(
      JoinErrorCodes.INVITATION_EXPIRED,
      'This invitation has expired. Ask your administrator for a new invite.'
    );
  }

  return {
    success: true,
    data: {
      id: invitation.id,
      email: invitation.email,
      maskedEmail: maskInvitationEmail(invitation.email),
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
      organizationSlug: invitation.organization.slug,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    },
  };
}

function validateInvitationAllowedDomain(
  email: string,
  metadata: string | null
): ServiceResult<true> | { success: false; error: { code: string; message: string } } {
  const { allowedDomains } = resolveJoinMetadata(metadata);

  // Secondary check only when the org has configured domains; empty list allows
  // invitation redemption (unlike slug join, which requires domains to be set).
  if (allowedDomains.length === 0) {
    return { success: true, data: true };
  }

  if (!emailMatchesAllowedDomains(email, allowedDomains)) {
    return joinFail(
      JoinErrorCodes.DOMAIN_NOT_ALLOWED,
      `Only work emails from ${allowedDomains.join(', ')} can join this organization.`
    );
  }

  return { success: true, data: true };
}

export async function validateInvitationForJoin(
  token: string,
  email: string
): Promise<
  ServiceResult<{
    invitationId: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: string;
  }>
> {
  const invitation = await loadInvitationByToken(token);

  if (!invitation) {
    return joinFail(JoinErrorCodes.INVITATION_NOT_FOUND, 'This invitation link is invalid.');
  }

  if (invitation.status !== 'pending') {
    return joinFail(
      JoinErrorCodes.INVITATION_NOT_PENDING,
      'This invitation is no longer active.'
    );
  }

  if (isInvitationExpired(invitation.expiresAt)) {
    return joinFail(
      JoinErrorCodes.INVITATION_EXPIRED,
      'This invitation has expired. Ask your administrator for a new invite.'
    );
  }

  const normalizedEmail = normalizeJoinEmail(email);
  if (normalizedEmail !== normalizeJoinEmail(invitation.email)) {
    return joinFail(
      JoinErrorCodes.INVITATION_EMAIL_MISMATCH,
      'This invitation was sent to a different email address.'
    );
  }

  const domainCheck = validateInvitationAllowedDomain(email, invitation.organization.metadata);
  if (!domainCheck.success) return domainCheck;

  return {
    success: true,
    data: {
      invitationId: invitation.id,
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
      organizationSlug: invitation.organization.slug,
      role: invitation.role,
    },
  };
}

export async function redeemInvitation(
  invitationId: string,
  organizationId: string
): Promise<ServiceResult<{ invitationId: string }>> {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId },
    select: { id: true, status: true },
  });

  if (!invitation) {
    return joinFail(JoinErrorCodes.INVITATION_NOT_FOUND, 'This invitation link is invalid.');
  }

  if (invitation.status !== 'pending') {
    return joinFail(
      JoinErrorCodes.INVITATION_NOT_PENDING,
      'This invitation is no longer active.'
    );
  }

  await prisma.invitation.updateMany({
    where: { id: invitationId, organizationId },
    data: { status: 'accepted' },
  });

  return { success: true, data: { invitationId } };
}

export async function completeInvitationJoin(
  token: string,
  userId: string,
  email: string
): Promise<ServiceResult<{ organizationId: string; memberId: string }>> {
  const validation = await validateInvitationForJoin(token, email);
  if (!validation.success) return validation;

  const { invitationId, organizationId, role } = validation.data;

  const existingMember = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { id: true },
  });

  if (existingMember) {
    return joinFail(
      JoinErrorCodes.ALREADY_MEMBER,
      'You are already a member of this organization.'
    );
  }

  try {
    const member = await prisma.$transaction(async (tx) => {
      const pendingInvitation = await tx.invitation.findFirst({
        where: {
          id: invitationId,
          organizationId,
          status: 'pending',
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!pendingInvitation) {
        return null;
      }

      const createdMember = await tx.member.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          role,
        },
        select: { id: true, organizationId: true },
      });

      await tx.invitation.updateMany({
        where: { id: invitationId, organizationId },
        data: { status: 'accepted' },
      });

      return createdMember;
    });

    if (!member) {
      const refresh = await getInvitationByToken(token);
      if (!refresh.success) return refresh;
      return joinFail(
        JoinErrorCodes.INVITATION_NOT_PENDING,
        'This invitation is no longer active.'
      );
    }

    return {
      success: true,
      data: {
        organizationId: member.organizationId,
        memberId: member.id,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return joinFail(
        JoinErrorCodes.ALREADY_MEMBER,
        'You are already a member of this organization.'
      );
    }
    throw error;
  }
}

function resolveJoinMetadata(
  metadata: string | null,
  fallbackEmail?: string
): OrganizationJoinMetadata {
  const parsed = parseOrganizationMetadata(metadata);
  if (parsed) return parsed;
  if (fallbackEmail) return createDefaultJoinMetadata(fallbackEmail);
  return { allowedDomains: [] };
}

export async function getOrganizationBySlug(
  slug: string
): Promise<ServiceResult<JoinOrganizationSummary>> {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const joinMetadata = resolveJoinMetadata(organization.metadata);

  return {
    success: true,
    data: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      allowedDomains: joinMetadata.allowedDomains,
    },
  };
}

export async function validateJoinEmail(
  orgSlug: string,
  email: string
): Promise<ServiceResult<{ organizationId: string; organizationName: string }>> {
  const orgResult = await getOrganizationBySlug(orgSlug);
  if (!orgResult.success) return orgResult;

  const { id, name, allowedDomains } = orgResult.data;

  if (allowedDomains.length === 0) {
    return joinFail(
      JoinErrorCodes.NO_ALLOWED_DOMAINS,
      'This organization has not configured allowed email domains yet.'
    );
  }

  if (!emailMatchesAllowedDomains(email, allowedDomains)) {
    return joinFail(
      JoinErrorCodes.DOMAIN_NOT_ALLOWED,
      `Only work emails from ${allowedDomains.join(', ')} can join this organization.`
    );
  }

  return { success: true, data: { organizationId: id, organizationName: name } };
}

/** @alias completeInvitationJoin — explicit name for invitation-backed membership */
export const completeJoinWithInvitation = completeInvitationJoin;

export async function completeJoinWithApprovedRequest(
  organizationId: string,
  userId: string,
  email: string
): Promise<ServiceResult<{ organizationId: string; memberId: string }>> {
  const normalizedEmail = normalizeJoinEmail(email);

  const existingMember = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { id: true },
  });

  if (existingMember) {
    return joinFail(
      JoinErrorCodes.ALREADY_MEMBER,
      'You are already a member of this organization.'
    );
  }

  try {
    const member = await prisma.$transaction(async (tx) => {
      const approvedRequest = await tx.joinRequest.findFirst({
        where: {
          organizationId,
          email: normalizedEmail,
          status: 'APPROVED',
        },
        select: { id: true, userId: true },
      });

      if (!approvedRequest) {
        return null;
      }

      const createdMember = await tx.member.create({
        data: {
          id: randomUUID(),
          organizationId,
          userId,
          role: 'member',
        },
        select: { id: true, organizationId: true },
      });

      if (!approvedRequest.userId) {
        await tx.joinRequest.update({
          where: { id: approvedRequest.id },
          data: { userId },
        });
      }

      return createdMember;
    });

    if (!member) {
      return joinFail(
        JoinErrorCodes.JOIN_REQUEST_NOT_APPROVED,
        'No approved join request was found for this email. Ask your administrator for an invitation or approval.'
      );
    }

    return {
      success: true,
      data: {
        organizationId: member.organizationId,
        memberId: member.id,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return joinFail(
        JoinErrorCodes.ALREADY_MEMBER,
        'You are already a member of this organization.'
      );
    }
    throw error;
  }
}

/**
 * Legacy slug completion entry point — domain-only self-join is disabled (TKT-107).
 * Membership is granted only via invitation or an approved join request.
 */
export async function completeOrganizationJoin(
  orgSlug: string,
  userId: string,
  email: string
): Promise<ServiceResult<{ organizationId: string; memberId: string }>> {
  void orgSlug;
  void userId;
  void email;
  return joinFail(
    JoinErrorCodes.INVITATION_REQUIRED,
    'Open organization join links are no longer supported. Use an invitation link from your administrator.'
  );
}

export async function initializeJoinMetadata(
  organizationId: string,
  ownerEmail: string
): Promise<ServiceResult<OrganizationJoinMetadata>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const existing = parseOrganizationMetadata(organization.metadata);
  if (existing && existing.allowedDomains.length > 0) {
    return { success: true, data: existing };
  }

  const metadata = createDefaultJoinMetadata(ownerEmail);

  await prisma.organization.update({
    where: { id: organizationId },
    data: { metadata: serializeOrganizationMetadata(metadata) },
  });

  return { success: true, data: metadata };
}

export async function getJoinSettingsForAdmin(
  organizationId: string,
  baseUrl: string
): Promise<ServiceResult<JoinSettings>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const joinMetadata = resolveJoinMetadata(organization.metadata);

  return {
    success: true,
    data: {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      allowedDomains: joinMetadata.allowedDomains,
      requireApproval: joinMetadata.requireApproval === true,
      joinUrl: `${baseUrl}/join/${organization.slug}`,
    },
  };
}

export async function updateJoinSettings(
  organizationId: string,
  updates: { allowedDomains?: string[]; requireApproval?: boolean }
): Promise<ServiceResult<JoinSettings>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const current = resolveJoinMetadata(organization.metadata);
  const metadata: OrganizationJoinMetadata = {
    allowedDomains: updates.allowedDomains ?? current.allowedDomains,
    requireApproval: updates.requireApproval ?? current.requireApproval,
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { metadata: serializeOrganizationMetadata(metadata) },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return {
    success: true,
    data: {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      allowedDomains: metadata.allowedDomains,
      requireApproval: metadata.requireApproval === true,
      joinUrl: `${baseUrl}/join/${organization.slug}`,
    },
  };
}
