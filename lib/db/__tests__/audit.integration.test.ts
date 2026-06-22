import '../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
} from '@/test/helpers/test-db';
import {
  AuditAction,
  AuditTargetType,
  auditInvitationSent,
  writeAuditLog,
} from '@/lib/db/audit';

const dbReady = await isTestDatabaseReady();
const AUDIT_TEST_SLUG = 'test-audit-org';
const AUDIT_TEST_ORG_ID = `test-org-${AUDIT_TEST_SLUG}`;
const AUDIT_TEST_USER_ID = 'test-audit-actor';
const AUDIT_TEST_EMAIL = 'actor@audit-test.local';

describe.skipIf(!dbReady)('writeAuditLog (integration)', () => {
  const prisma = getTestPrisma();

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({
      where: { organization: { slug: { startsWith: 'test-audit-' } } },
    });
    await prisma.member.deleteMany({
      where: { organization: { slug: { startsWith: 'test-audit-' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@audit-test.local' } },
    });
    await prisma.organization.deleteMany({
      where: { slug: { startsWith: 'test-audit-' } },
    });

    await prisma.organization.create({
      data: {
        id: AUDIT_TEST_ORG_ID,
        name: 'Audit Test Org',
        slug: AUDIT_TEST_SLUG,
      },
    });

    await prisma.user.create({
      data: {
        id: AUDIT_TEST_USER_ID,
        name: 'Audit Actor',
        email: AUDIT_TEST_EMAIL,
        emailVerified: true,
      },
    });

    await prisma.member.create({
      data: {
        id: 'test-audit-member-owner',
        organizationId: AUDIT_TEST_ORG_ID,
        userId: AUDIT_TEST_USER_ID,
        role: 'owner',
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { organization: { slug: { startsWith: 'test-audit-' } } },
    });
    await prisma.member.deleteMany({
      where: { organization: { slug: { startsWith: 'test-audit-' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { endsWith: '@audit-test.local' } },
    });
    await prisma.organization.deleteMany({
      where: { slug: { startsWith: 'test-audit-' } },
    });
    await prisma.$disconnect();
  });

  it('persists a row scoped to organizationId', async () => {
    const invitationId = crypto.randomUUID();

    await writeAuditLog({
      organizationId: AUDIT_TEST_ORG_ID,
      actorUserId: AUDIT_TEST_USER_ID,
      action: AuditAction.INVITATION_SENT,
      targetType: AuditTargetType.INVITATION,
      targetId: invitationId,
      metadata: { email: 'invitee@example.com', role: 'member' },
      db: prisma,
    });

    const rows = await prisma.auditLog.findMany({
      where: { organizationId: AUDIT_TEST_ORG_ID },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationId: AUDIT_TEST_ORG_ID,
      actorUserId: AUDIT_TEST_USER_ID,
      action: AuditAction.INVITATION_SENT,
      targetType: AuditTargetType.INVITATION,
      targetId: invitationId,
    });
    expect(rows[0]?.metadata).toEqual({
      email: 'invitee@example.com',
      role: 'member',
    });
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('does not leak rows across tenants', async () => {
    const otherOrgId = 'test-org-test-audit-other';
    const otherSlug = 'test-audit-other';

    await prisma.organization.create({
      data: {
        id: otherOrgId,
        name: 'Other Audit Org',
        slug: otherSlug,
      },
    });

    await auditInvitationSent({
      organizationId: AUDIT_TEST_ORG_ID,
      actorUserId: AUDIT_TEST_USER_ID,
      invitationId: crypto.randomUUID(),
      metadata: { email: 'a@example.com', role: 'member' },
      db: prisma,
    });

    await auditInvitationSent({
      organizationId: otherOrgId,
      actorUserId: AUDIT_TEST_USER_ID,
      invitationId: crypto.randomUUID(),
      metadata: { email: 'b@example.com', role: 'admin' },
      db: prisma,
    });

    const tenantARows = await prisma.auditLog.findMany({
      where: { organizationId: AUDIT_TEST_ORG_ID },
    });
    const tenantBRows = await prisma.auditLog.findMany({
      where: { organizationId: otherOrgId },
    });

    expect(tenantARows).toHaveLength(1);
    expect(tenantBRows).toHaveLength(1);
    expect(tenantARows[0]?.organizationId).toBe(AUDIT_TEST_ORG_ID);
    expect(tenantBRows[0]?.organizationId).toBe(otherOrgId);
  });

  it('swallows persistence errors without throwing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      writeAuditLog({
        organizationId: AUDIT_TEST_ORG_ID,
        actorUserId: 'nonexistent-user-id',
        action: AuditAction.INVITATION_SENT,
        targetType: AuditTargetType.INVITATION,
        targetId: crypto.randomUUID(),
        db: prisma,
      })
    ).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

if (!dbReady) {
  console.warn(
    '[integration] Test database not available — skipped audit integration tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
