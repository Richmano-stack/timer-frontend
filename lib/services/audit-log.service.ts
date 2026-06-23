import { prisma } from '@/lib/db/prisma';
import type { AuditActionValue } from '@/lib/db/audit';
import { ServiceResult } from '@/lib/types/api-response';

const AUDIT_LOG_LIST_LIMIT = 100;

export interface AuditLogListFilters {
  action?: AuditActionValue | string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorUserId: string;
  actorEmail: string;
  metadata: unknown | null;
  createdAt: string;
}

function toAuditLogDto(row: {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorUserId: string;
  metadata: unknown;
  createdAt: Date;
  actor: { email: string };
}): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    actorUserId: row.actorUserId,
    actorEmail: row.actor.email,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAuditLogsForAdmin(
  organizationId: string,
  filters?: AuditLogListFilters
): Promise<ServiceResult<AuditLogDto[]>> {
  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(filters?.action ? { action: filters.action } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: AUDIT_LOG_LIST_LIMIT,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      actorUserId: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: { email: true },
      },
    },
  });

  return {
    success: true,
    data: logs.map(toAuditLogDto),
  };
}
