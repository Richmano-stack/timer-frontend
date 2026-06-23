import { PrismaClient } from '@prisma/client';
import { serializeOrganizationMetadata } from '@/lib/organization/metadata';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://timer_test_user:timer_test_secret@localhost:5435/timer_test';

let readiness: boolean | null = null;

export function getTestPrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: TEST_DATABASE_URL } },
    log: ['error'],
  });
}

export async function isTestDatabaseReady(): Promise<boolean> {
  if (readiness !== null) return readiness;

  const prisma = getTestPrisma();
  try {
    await prisma.$queryRaw`SELECT 1`;
    readiness = true;
  } catch {
    readiness = false;
  } finally {
    await prisma.$disconnect();
  }

  return readiness;
}

export async function migrateTestDatabase(): Promise<void> {
  const { execSync } = await import('node:child_process');
  const { resolve } = await import('node:path');
  const prismaBin = resolve(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
  );
  execSync(`"${prismaBin}" migrate deploy`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
    shell: true,
  });
}

export async function resetJoinTestData(prisma: PrismaClient): Promise<void> {
  await prisma.joinRequest.deleteMany({
    where: { organization: { slug: { startsWith: 'test-join-' } } },
  });
  await prisma.invitation.deleteMany({
    where: { organization: { slug: { startsWith: 'test-join-' } } },
  });
  await prisma.member.deleteMany({
    where: { organization: { slug: { startsWith: 'test-join-' } } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@join-test.local' } },
  });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: 'test-join-' } },
  });
}

export async function resetInvitationTestData(prisma: PrismaClient): Promise<void> {
  await prisma.invitation.deleteMany({
    where: { organization: { slug: { startsWith: 'test-invite-' } } },
  });
  await prisma.member.deleteMany({
    where: { organization: { slug: { startsWith: 'test-invite-' } } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@invite-test.local' } },
  });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: 'test-invite-' } },
  });
}

export interface InvitationTestFixtures {
  organizationId: string;
  organizationSlug: string;
  owner: { id: string; email: string };
  admin: { id: string; email: string };
  member: { id: string; email: string };
  existingMember: { id: string; email: string };
}

export async function seedInvitationTestFixtures(
  prisma: PrismaClient,
  slug = 'test-invite-org'
): Promise<InvitationTestFixtures> {
  const organizationId = `test-org-${slug}`;

  await prisma.organization.upsert({
    where: { slug },
    create: {
      id: organizationId,
      name: 'Invitation Test Org',
      slug,
    },
    update: {
      name: 'Invitation Test Org',
    },
  });

  const owner = { id: 'test-invite-owner', email: 'owner@invite-test.local' };
  const admin = { id: 'test-invite-admin', email: 'admin@invite-test.local' };
  const member = { id: 'test-invite-member', email: 'member@invite-test.local' };
  const existingMember = {
    id: 'test-invite-existing',
    email: 'existing@invite-test.local',
  };

  for (const user of [owner, admin, member, existingMember]) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.email.split('@')[0] ?? user.id,
        email: user.email,
        emailVerified: true,
      },
      update: {
        email: user.email,
        emailVerified: true,
      },
    });
  }

  const memberships = [
    { id: 'test-invite-member-owner', userId: owner.id, role: 'owner' },
    { id: 'test-invite-member-admin', userId: admin.id, role: 'admin' },
    { id: 'test-invite-member-agent', userId: member.id, role: 'member' },
    {
      id: 'test-invite-member-existing',
      userId: existingMember.id,
      role: 'member',
    },
  ];

  for (const membership of memberships) {
    await prisma.member.upsert({
      where: { id: membership.id },
      create: {
        id: membership.id,
        organizationId,
        userId: membership.userId,
        role: membership.role,
      },
      update: {
        role: membership.role,
      },
    });
  }

  return {
    organizationId,
    organizationSlug: slug,
    owner,
    admin,
    member,
    existingMember,
  };
}

export async function seedJoinTestOrganization(
  prisma: PrismaClient,
  slug = 'test-join-org'
) {
  const organizationId = `test-org-${slug}`;

  return prisma.organization.upsert({
    where: { slug },
    create: {
      id: organizationId,
      name: 'Join Test Org',
      slug,
      metadata: serializeOrganizationMetadata({ allowedDomains: ['join-test.local'] }),
    },
    update: {
      metadata: serializeOrganizationMetadata({ allowedDomains: ['join-test.local'] }),
    },
  });
}

export async function createJoinTestUser(
  prisma: PrismaClient,
  index: number
): Promise<{ id: string; email: string }> {
  const id = `test-join-user-${index}`;
  const email = `agent${index}@join-test.local`;

  await prisma.user.upsert({
    where: { id },
    create: {
      id,
      name: `Join Test Agent ${index}`,
      email,
      emailVerified: true,
    },
    update: {
      name: `Join Test Agent ${index}`,
      email,
      emailVerified: true,
    },
  });

  return { id, email };
}

export async function createJoinTestInviter(
  prisma: PrismaClient
): Promise<{ id: string; email: string }> {
  const id = 'test-join-inviter';
  const email = 'owner@join-test.local';

  await prisma.user.upsert({
    where: { id },
    create: {
      id,
      name: 'Join Test Owner',
      email,
      emailVerified: true,
    },
    update: {
      name: 'Join Test Owner',
      email,
      emailVerified: true,
    },
  });

  return { id, email };
}

const ISOLATION_SLUG_PREFIX = 'test-isolation-tenant-';
const ISOLATION_EMAIL_DOMAIN = '@isolation-test.local';

export interface TenantIsolationUser {
  id: string;
  email: string;
  memberId: string;
}

export interface TenantIsolationFixture {
  organizationId: string;
  slug: string;
  owner: TenantIsolationUser;
  admin: TenantIsolationUser;
  member: TenantIsolationUser;
  availableStatusId: string;
}

export interface TenantIsolationFixtures {
  tenantA: TenantIsolationFixture;
  tenantB: TenantIsolationFixture;
}

export async function resetTenantIsolationTestData(prisma: PrismaClient): Promise<void> {
  await prisma.idempotencyKey.deleteMany({
    where: { organization: { slug: { startsWith: ISOLATION_SLUG_PREFIX } } },
  });
  await prisma.timeLogAudit.deleteMany({
    where: { organization: { slug: { startsWith: ISOLATION_SLUG_PREFIX } } },
  });
  await prisma.timeLog.deleteMany({
    where: { organization: { slug: { startsWith: ISOLATION_SLUG_PREFIX } } },
  });
  await prisma.activityStatus.deleteMany({
    where: { organization: { slug: { startsWith: ISOLATION_SLUG_PREFIX } } },
  });
  await prisma.invitation.deleteMany({
    where: { organization: { slug: { startsWith: ISOLATION_SLUG_PREFIX } } },
  });
  await prisma.joinRequest.deleteMany({
    where: { organization: { slug: { startsWith: ISOLATION_SLUG_PREFIX } } },
  });
  await prisma.member.deleteMany({
    where: { organization: { slug: { startsWith: ISOLATION_SLUG_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: ISOLATION_EMAIL_DOMAIN } },
  });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: ISOLATION_SLUG_PREFIX } },
  });
}

async function seedTenantIsolationOrg(
  prisma: PrismaClient,
  suffix: 'a' | 'b'
): Promise<TenantIsolationFixture> {
  const slug = `${ISOLATION_SLUG_PREFIX}${suffix}`;
  const organizationId = `test-isolation-org-${suffix}`;

  await prisma.organization.upsert({
    where: { slug },
    create: {
      id: organizationId,
      name: `Isolation Tenant ${suffix.toUpperCase()}`,
      slug,
      metadata: serializeOrganizationMetadata({
        allowedDomains: [`tenant-${suffix}.example`],
      }),
    },
    update: {
      name: `Isolation Tenant ${suffix.toUpperCase()}`,
      metadata: serializeOrganizationMetadata({
        allowedDomains: [`tenant-${suffix}.example`],
      }),
    },
  });

  const owner = {
    id: `test-isolation-owner-${suffix}`,
    email: `owner-${suffix}${ISOLATION_EMAIL_DOMAIN}`,
    memberId: `test-isolation-member-owner-${suffix}`,
  };
  const admin = {
    id: `test-isolation-admin-${suffix}`,
    email: `admin-${suffix}${ISOLATION_EMAIL_DOMAIN}`,
    memberId: `test-isolation-member-admin-${suffix}`,
  };
  const member = {
    id: `test-isolation-agent-${suffix}`,
    email: `agent-${suffix}${ISOLATION_EMAIL_DOMAIN}`,
    memberId: `test-isolation-member-agent-${suffix}`,
  };

  for (const user of [owner, admin, member]) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.email.split('@')[0] ?? user.id,
        email: user.email,
        emailVerified: true,
      },
      update: {
        email: user.email,
        emailVerified: true,
      },
    });
  }

  const memberships = [
    { ...owner, role: 'owner' },
    { ...admin, role: 'admin' },
    { ...member, role: 'member' },
  ];

  for (const entry of memberships) {
    await prisma.member.upsert({
      where: { id: entry.memberId },
      create: {
        id: entry.memberId,
        organizationId,
        userId: entry.id,
        role: entry.role,
      },
      update: { role: entry.role },
    });
  }

  const { seedDefaultActivityStatuses } = await import(
    '@/lib/services/organization-bootstrap.service'
  );
  await seedDefaultActivityStatuses(organizationId);

  const availableStatus = await prisma.activityStatus.findFirst({
    where: { organizationId, name: 'Available' },
    select: { id: true },
  });

  if (!availableStatus) {
    throw new Error(`Missing Available status for isolation tenant ${suffix}`);
  }

  return {
    organizationId,
    slug,
    owner,
    admin,
    member,
    availableStatusId: availableStatus.id,
  };
}

export async function seedTenantIsolationFixtures(
  prisma: PrismaClient
): Promise<TenantIsolationFixtures> {
  const tenantA = await seedTenantIsolationOrg(prisma, 'a');
  const tenantB = await seedTenantIsolationOrg(prisma, 'b');
  return { tenantA, tenantB };
}

export async function resetActivityStatusTestData(prisma: PrismaClient): Promise<void> {
  await prisma.timeLog.deleteMany({
    where: { organization: { slug: { startsWith: 'test-activity-status-' } } },
  });
  await prisma.activityStatus.deleteMany({
    where: { organization: { slug: { startsWith: 'test-activity-status-' } } },
  });
  await prisma.member.deleteMany({
    where: { organization: { slug: { startsWith: 'test-activity-status-' } } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@activity-status-test.local' } },
  });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: 'test-activity-status-' } },
  });
}

export interface ActivityStatusTestFixtures {
  organizationId: string;
  organizationSlug: string;
  owner: { id: string; email: string };
  admin: { id: string; email: string };
  member: { id: string; email: string };
  availableStatusId: string;
}

export async function seedActivityStatusTestFixtures(
  prisma: PrismaClient,
  slug = 'test-activity-status-org'
): Promise<ActivityStatusTestFixtures> {
  const organizationId = `test-org-${slug}`;

  await prisma.organization.upsert({
    where: { slug },
    create: {
      id: organizationId,
      name: 'Activity Status Test Org',
      slug,
    },
    update: {
      name: 'Activity Status Test Org',
    },
  });

  const owner = { id: 'test-activity-status-owner', email: 'owner@activity-status-test.local' };
  const admin = { id: 'test-activity-status-admin', email: 'admin@activity-status-test.local' };
  const member = { id: 'test-activity-status-member', email: 'member@activity-status-test.local' };

  for (const user of [owner, admin, member]) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.email.split('@')[0] ?? user.id,
        email: user.email,
        emailVerified: true,
      },
      update: {
        email: user.email,
        emailVerified: true,
      },
    });
  }

  const memberships = [
    { id: 'test-activity-status-member-owner', userId: owner.id, role: 'owner' },
    { id: 'test-activity-status-member-admin', userId: admin.id, role: 'admin' },
    { id: 'test-activity-status-member-agent', userId: member.id, role: 'member' },
  ];

  for (const membership of memberships) {
    await prisma.member.upsert({
      where: { id: membership.id },
      create: {
        id: membership.id,
        organizationId,
        userId: membership.userId,
        role: membership.role,
      },
      update: {
        role: membership.role,
      },
    });
  }

  const { seedDefaultActivityStatuses } = await import(
    '@/lib/services/organization-bootstrap.service'
  );
  await seedDefaultActivityStatuses(organizationId);

  const availableStatus = await prisma.activityStatus.findFirst({
    where: { organizationId, name: 'Available' },
    select: { id: true },
  });

  if (!availableStatus) {
    throw new Error(`Missing Available status for activity status test org ${slug}`);
  }

  return {
    organizationId,
    organizationSlug: slug,
    owner,
    admin,
    member,
    availableStatusId: availableStatus.id,
  };
}

export async function seedJoinTestInvitation(
  prisma: PrismaClient,
  options: {
    organizationId: string;
    inviterId: string;
    email?: string;
    status?: string;
    expiresAt?: Date;
    role?: string;
    id?: string;
  }
) {
  const id = options.id ?? crypto.randomUUID();
  const email = options.email ?? 'invited@join-test.local';

  return prisma.invitation.create({
    data: {
      id,
      organizationId: options.organizationId,
      email,
      role: options.role ?? 'member',
      status: options.status ?? 'pending',
      expiresAt: options.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inviterId: options.inviterId,
    },
  });
}

const AUDIT_LOG_SLUG_PREFIX = 'test-audit-log-';
const AUDIT_LOG_EMAIL_DOMAIN = '@audit-log-test.local';

export interface AuditLogTestFixtures {
  organizationId: string;
  organizationSlug: string;
  owner: { id: string; email: string };
  admin: { id: string; email: string };
  member: { id: string; email: string };
}

export async function resetAuditLogTestData(prisma: PrismaClient): Promise<void> {
  await prisma.auditLog.deleteMany({
    where: { organization: { slug: { startsWith: AUDIT_LOG_SLUG_PREFIX } } },
  });
  await prisma.member.deleteMany({
    where: { organization: { slug: { startsWith: AUDIT_LOG_SLUG_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { email: { endsWith: AUDIT_LOG_EMAIL_DOMAIN } },
  });
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: AUDIT_LOG_SLUG_PREFIX } },
  });
}

export async function seedAuditLogTestFixtures(
  prisma: PrismaClient,
  slug = 'test-audit-log-org-a'
): Promise<AuditLogTestFixtures> {
  const organizationId = `test-org-${slug}`;

  await prisma.organization.upsert({
    where: { slug },
    create: {
      id: organizationId,
      name: 'Audit Log Test Org',
      slug,
    },
    update: {
      name: 'Audit Log Test Org',
    },
  });

  const owner = { id: `test-audit-log-owner-${slug}`, email: `owner-${slug}${AUDIT_LOG_EMAIL_DOMAIN}` };
  const admin = { id: `test-audit-log-admin-${slug}`, email: `admin-${slug}${AUDIT_LOG_EMAIL_DOMAIN}` };
  const member = { id: `test-audit-log-member-${slug}`, email: `member-${slug}${AUDIT_LOG_EMAIL_DOMAIN}` };

  for (const user of [owner, admin, member]) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        name: user.email.split('@')[0] ?? user.id,
        email: user.email,
        emailVerified: true,
      },
      update: {
        email: user.email,
        emailVerified: true,
      },
    });
  }

  const memberships = [
    { id: `test-audit-log-member-owner-${slug}`, userId: owner.id, role: 'owner' },
    { id: `test-audit-log-member-admin-${slug}`, userId: admin.id, role: 'admin' },
    { id: `test-audit-log-member-agent-${slug}`, userId: member.id, role: 'member' },
  ];

  for (const membership of memberships) {
    await prisma.member.upsert({
      where: { id: membership.id },
      create: {
        id: membership.id,
        organizationId,
        userId: membership.userId,
        role: membership.role,
      },
      update: {
        role: membership.role,
      },
    });
  }

  return {
    organizationId,
    organizationSlug: slug,
    owner,
    admin,
    member,
  };
}

export async function seedAuditLogRows(
  prisma: PrismaClient,
  options: {
    organizationId: string;
    actorUserId: string;
    rows: Array<{
      action: string;
      targetType: string;
      targetId: string;
      metadata?: Record<string, unknown>;
      createdAt?: Date;
    }>;
  }
): Promise<void> {
  for (const row of options.rows) {
    await prisma.auditLog.create({
      data: {
        organizationId: options.organizationId,
        actorUserId: options.actorUserId,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
        createdAt: row.createdAt,
      },
    });
  }
}
