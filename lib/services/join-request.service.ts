import { Prisma } from '@prisma/client';
import { auditJoinRequestDenied } from '@/lib/db/audit';
import { prisma } from '@/lib/db/prisma';
import { JoinErrorCodes } from '@/lib/errors/join';
import { fail as joinFail } from '@/lib/errors/join-service';
import {
  parseOrganizationMetadata,
  type OrganizationJoinMetadata,
} from '@/lib/organization/metadata';
import { ServiceResult } from '@/lib/types/api-response';
import {
  completeJoinWithApprovedRequest,
  validateJoinEmail,
} from '@/lib/services/join.service';

export interface SubmitJoinRequestResult {
  status: 'pending' | 'joined';
  joinRequestId?: string;
  organizationId?: string;
  memberId?: string;
  organizationName?: string;
  message: string;
}

export interface ApproveJoinRequestResult {
  joinRequestId: string;
  organizationId: string;
  memberId: string | null;
  email: string;
}

export type JoinRequestListStatus = 'PENDING' | 'APPROVED' | 'DENIED';

export interface JoinRequestListItem {
  id: string;
  email: string;
  status: JoinRequestListStatus;
  createdAt: string;
  reviewedAt: string | null;
}

export interface DenyJoinRequestResult {
  joinRequestId: string;
  email: string;
}

function normalizeJoinEmail(email: string): string {
  return email.trim().toLowerCase();
}

function resolveJoinMetadata(metadata: string | null): OrganizationJoinMetadata {
  return parseOrganizationMetadata(metadata) ?? { allowedDomains: [] };
}

export async function submitJoinRequest(
  orgSlug: string,
  email: string,
  userId?: string
): Promise<ServiceResult<SubmitJoinRequestResult>> {
  const normalizedEmail = normalizeJoinEmail(email);

  const validation = await validateJoinEmail(orgSlug, normalizedEmail);
  if (!validation.success) return validation;

  const { organizationId, organizationName } = validation.data;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const joinMetadata = resolveJoinMetadata(organization.metadata);
  const requireApproval = joinMetadata.requireApproval === true;

  if (userId) {
    const existingMember = await prisma.member.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      select: { id: true },
    });

    if (existingMember) {
      return joinFail(
        JoinErrorCodes.ALREADY_MEMBER,
        'You are already a member of this organization.'
      );
    }

    const approvedJoin = await completeJoinWithApprovedRequest(
      organizationId,
      userId,
      normalizedEmail
    );
    if (approvedJoin.success) {
      return {
        success: true,
        data: {
          status: 'joined',
          organizationId: approvedJoin.data.organizationId,
          memberId: approvedJoin.data.memberId,
          organizationName,
          message: 'You have joined the organization.',
        },
      };
    }
    if (approvedJoin.error.code !== JoinErrorCodes.JOIN_REQUEST_NOT_APPROVED) {
      return approvedJoin;
    }
  }

  if (!requireApproval) {
    if (!userId) {
      return joinFail(
        JoinErrorCodes.AUTH_REQUIRED,
        'Sign in to join this organization, or use an invitation link from your administrator.'
      );
    }

    try {
      await prisma.joinRequest.create({
        data: {
          organizationId,
          email: normalizedEmail,
          userId,
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const approvedJoin = await completeJoinWithApprovedRequest(
          organizationId,
          userId,
          normalizedEmail
        );
        if (approvedJoin.success) {
          return {
            success: true,
            data: {
              status: 'joined',
              organizationId: approvedJoin.data.organizationId,
              memberId: approvedJoin.data.memberId,
              organizationName,
              message: 'You have joined the organization.',
            },
          };
        }
        return approvedJoin;
      }
      throw error;
    }

    const joinResult = await completeJoinWithApprovedRequest(
      organizationId,
      userId,
      normalizedEmail
    );
    if (!joinResult.success) return joinResult;

    return {
      success: true,
      data: {
        status: 'joined',
        organizationId: joinResult.data.organizationId,
        memberId: joinResult.data.memberId,
        organizationName,
        message: 'You have joined the organization.',
      },
    };
  }

  const existingPending = await prisma.joinRequest.findFirst({
    where: {
      organizationId,
      email: normalizedEmail,
      status: 'PENDING',
    },
    select: { id: true },
  });

  if (existingPending) {
    return joinFail(
      JoinErrorCodes.JOIN_REQUEST_ALREADY_PENDING,
      'A join request for this email is already pending review.'
    );
  }

  try {
    const joinRequest = await prisma.joinRequest.create({
      data: {
        organizationId,
        email: normalizedEmail,
        userId: userId ?? null,
        status: 'PENDING',
      },
      select: { id: true },
    });

    return {
      success: true,
      data: {
        status: 'pending',
        joinRequestId: joinRequest.id,
        organizationName,
        message:
          'Your join request has been submitted and is awaiting administrator approval.',
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return joinFail(
        JoinErrorCodes.JOIN_REQUEST_ALREADY_PENDING,
        'A join request for this email is already pending review.'
      );
    }
    throw error;
  }
}

export async function approveJoinRequest(
  joinRequestId: string,
  organizationId: string,
  reviewerId: string
): Promise<ServiceResult<ApproveJoinRequestResult>> {
  const joinRequest = await prisma.joinRequest.findFirst({
    where: { id: joinRequestId, organizationId },
    select: {
      id: true,
      email: true,
      userId: true,
      status: true,
      organizationId: true,
    },
  });

  if (!joinRequest) {
    return joinFail(JoinErrorCodes.JOIN_REQUEST_NOT_FOUND, 'Join request not found.');
  }

  if (joinRequest.status !== 'PENDING') {
    return joinFail(
      JoinErrorCodes.JOIN_REQUEST_NOT_PENDING,
      'This join request is no longer pending approval.'
    );
  }

  const resolvedUserId =
    joinRequest.userId ??
    (
      await prisma.user.findUnique({
        where: { email: joinRequest.email },
        select: { id: true },
      })
    )?.id ??
    null;

  if (resolvedUserId) {
    const existingMember = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: resolvedUserId,
        },
      },
      select: { id: true },
    });

    if (existingMember) {
      await prisma.joinRequest.update({
        where: { id: joinRequestId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          userId: resolvedUserId,
        },
      });

      return {
        success: true,
        data: {
          joinRequestId,
          organizationId,
          memberId: existingMember.id,
          email: joinRequest.email,
        },
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pending = await tx.joinRequest.findFirst({
        where: {
          id: joinRequestId,
          organizationId,
          status: 'PENDING',
        },
        select: { id: true, email: true, userId: true },
      });

      if (!pending) {
        return null;
      }

      const userId =
        pending.userId ??
        (
          await tx.user.findUnique({
            where: { email: pending.email },
            select: { id: true },
          })
        )?.id ??
        null;

      await tx.joinRequest.update({
        where: { id: joinRequestId },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          userId,
        },
      });

      return { userId, email: pending.email };
    });

    if (!result) {
      return joinFail(
        JoinErrorCodes.JOIN_REQUEST_NOT_PENDING,
        'This join request is no longer pending approval.'
      );
    }

    if (result.userId) {
      const joinResult = await completeJoinWithApprovedRequest(
        organizationId,
        result.userId,
        result.email
      );
      if (!joinResult.success) return joinResult;

      return {
        success: true,
        data: {
          joinRequestId,
          organizationId,
          memberId: joinResult.data.memberId,
          email: result.email,
        },
      };
    }

    return {
      success: true,
      data: {
        joinRequestId,
        organizationId,
        memberId: null,
        email: result.email,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return joinFail(
        JoinErrorCodes.ALREADY_MEMBER,
        'This user is already a member of the organization.'
      );
    }
    throw error;
  }
}

export async function listJoinRequestsForAdmin(
  organizationId: string,
  status: JoinRequestListStatus
): Promise<ServiceResult<JoinRequestListItem[]>> {
  const joinRequests = await prisma.joinRequest.findMany({
    where: {
      organizationId,
      status,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
    },
  });

  return {
    success: true,
    data: joinRequests.map((request) => ({
      id: request.id,
      email: request.email,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
    })),
  };
}

export async function denyJoinRequest(
  joinRequestId: string,
  organizationId: string,
  reviewerId: string
): Promise<ServiceResult<DenyJoinRequestResult>> {
  const joinRequest = await prisma.joinRequest.findFirst({
    where: { id: joinRequestId, organizationId },
    select: {
      id: true,
      email: true,
      status: true,
    },
  });

  if (!joinRequest) {
    return joinFail(JoinErrorCodes.JOIN_REQUEST_NOT_FOUND, 'Join request not found.');
  }

  if (joinRequest.status !== 'PENDING') {
    return joinFail(
      JoinErrorCodes.JOIN_REQUEST_NOT_PENDING,
      'This join request is no longer pending approval.'
    );
  }

  const updated = await prisma.joinRequest.updateMany({
    where: {
      id: joinRequestId,
      organizationId,
      status: 'PENDING',
    },
    data: {
      status: 'DENIED',
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    },
  });

  if (updated.count === 0) {
    return joinFail(
      JoinErrorCodes.JOIN_REQUEST_NOT_PENDING,
      'This join request is no longer pending approval.'
    );
  }

  void auditJoinRequestDenied({
    organizationId,
    actorUserId: reviewerId,
    joinRequestId,
    metadata: { email: joinRequest.email },
  });

  return {
    success: true,
    data: {
      joinRequestId,
      email: joinRequest.email,
    },
  };
}
