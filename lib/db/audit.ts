import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

/**
 * AUDIT_EVENTS — Phase 1 event contract (append-only AuditLog rows).
 *
 * Wiring targets (follow-up PR after TKT-108 merges):
 * | Action                      | Service / mutation site                          | targetType    |
 * |-----------------------------|--------------------------------------------------|---------------|
 * | invitation.sent             | invitation.service createInvitationForAdmin        | invitation    |
 * | invitation.accepted         | join.service invitation redeem                   | invitation    |
 * | join_request.approved       | join-request.service approveJoinRequest          | join_request  |
 * | join_request.denied         | join-request.service denyJoinRequest               | join_request  |
 * | member.role_changed         | organization-team.service updateMemberRoleForAdmin | member        |
 * | domain_whitelist.updated    | join.service updateJoinSettings                    | organization  |
 */
export const AuditAction = {
  INVITATION_SENT: 'invitation.sent',
  INVITATION_ACCEPTED: 'invitation.accepted',
  JOIN_REQUEST_APPROVED: 'join_request.approved',
  JOIN_REQUEST_DENIED: 'join_request.denied',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  DOMAIN_WHITELIST_UPDATED: 'domain_whitelist.updated',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditTargetType = {
  INVITATION: 'invitation',
  JOIN_REQUEST: 'join_request',
  MEMBER: 'member',
  ORGANIZATION: 'organization',
} as const;

export type AuditTargetTypeValue = (typeof AuditTargetType)[keyof typeof AuditTargetType];

export type AuditMetadata = Prisma.InputJsonValue;

export interface WriteAuditLogInput {
  organizationId: string;
  actorUserId: string;
  action: AuditActionValue;
  targetType: AuditTargetTypeValue | string;
  targetId: string;
  metadata?: AuditMetadata;
  /** Optional client for transactional writes alongside the mutating operation. */
  db?: Pick<typeof prisma, 'auditLog'>;
}

/**
 * Persists one append-only audit row scoped to organizationId.
 *
 * Never throws on failure — audit must not block the primary mutation path.
 * Errors are logged to stderr so operators can alert on audit pipeline health.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  const { db = prisma, ...data } = input;

  try {
    await db.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorUserId: data.actorUserId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        metadata: data.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error('[audit] writeAuditLog failed', {
      organizationId: data.organizationId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      error,
    });
  }
}

export interface InvitationAuditMetadata {
  email: string;
  role: string;
}

export async function auditInvitationSent(
  params: {
    organizationId: string;
    actorUserId: string;
    invitationId: string;
    metadata: InvitationAuditMetadata;
  } & Pick<WriteAuditLogInput, 'db'>
): Promise<void> {
  const { organizationId, actorUserId, invitationId, metadata, db } = params;
  await writeAuditLog({
    organizationId,
    actorUserId,
    action: AuditAction.INVITATION_SENT,
    targetType: AuditTargetType.INVITATION,
    targetId: invitationId,
    metadata,
    db,
  });
}

export async function auditInvitationAccepted(
  params: {
    organizationId: string;
    actorUserId: string;
    invitationId: string;
    metadata?: AuditMetadata;
  } & Pick<WriteAuditLogInput, 'db'>
): Promise<void> {
  const { organizationId, actorUserId, invitationId, metadata, db } = params;
  await writeAuditLog({
    organizationId,
    actorUserId,
    action: AuditAction.INVITATION_ACCEPTED,
    targetType: AuditTargetType.INVITATION,
    targetId: invitationId,
    metadata,
    db,
  });
}

export async function auditJoinRequestApproved(
  params: {
    organizationId: string;
    actorUserId: string;
    joinRequestId: string;
    metadata?: AuditMetadata;
  } & Pick<WriteAuditLogInput, 'db'>
): Promise<void> {
  const { organizationId, actorUserId, joinRequestId, metadata, db } = params;
  await writeAuditLog({
    organizationId,
    actorUserId,
    action: AuditAction.JOIN_REQUEST_APPROVED,
    targetType: AuditTargetType.JOIN_REQUEST,
    targetId: joinRequestId,
    metadata,
    db,
  });
}

export async function auditJoinRequestDenied(
  params: {
    organizationId: string;
    actorUserId: string;
    joinRequestId: string;
    metadata?: AuditMetadata;
  } & Pick<WriteAuditLogInput, 'db'>
): Promise<void> {
  const { organizationId, actorUserId, joinRequestId, metadata, db } = params;
  await writeAuditLog({
    organizationId,
    actorUserId,
    action: AuditAction.JOIN_REQUEST_DENIED,
    targetType: AuditTargetType.JOIN_REQUEST,
    targetId: joinRequestId,
    metadata,
    db,
  });
}

export interface MemberRoleChangedMetadata {
  userId: string;
  beforeRole: string;
  afterRole: string;
}

export async function auditMemberRoleChanged(
  params: {
    organizationId: string;
    actorUserId: string;
    memberId: string;
    metadata: MemberRoleChangedMetadata;
  } & Pick<WriteAuditLogInput, 'db'>
): Promise<void> {
  const { organizationId, actorUserId, memberId, metadata, db } = params;
  await writeAuditLog({
    organizationId,
    actorUserId,
    action: AuditAction.MEMBER_ROLE_CHANGED,
    targetType: AuditTargetType.MEMBER,
    targetId: memberId,
    metadata,
    db,
  });
}

export interface DomainWhitelistUpdatedMetadata {
  before?: { allowedDomains?: string[]; requireApproval?: boolean };
  after: { allowedDomains?: string[]; requireApproval?: boolean };
}

export async function auditDomainWhitelistUpdated(
  params: {
    organizationId: string;
    actorUserId: string;
    metadata: DomainWhitelistUpdatedMetadata;
  } & Pick<WriteAuditLogInput, 'db'>
): Promise<void> {
  const { organizationId, actorUserId, metadata, db } = params;
  await writeAuditLog({
    organizationId,
    actorUserId,
    action: AuditAction.DOMAIN_WHITELIST_UPDATED,
    targetType: AuditTargetType.ORGANIZATION,
    targetId: organizationId,
    metadata,
    db,
  });
}
