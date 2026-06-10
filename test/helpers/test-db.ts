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
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}

export async function resetJoinTestData(prisma: PrismaClient): Promise<void> {
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
