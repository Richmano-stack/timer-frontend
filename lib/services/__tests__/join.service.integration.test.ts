import '../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createJoinTestUser,
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetJoinTestData,
  seedJoinTestOrganization,
} from '@/test/helpers/test-db';

const dbReady = await isTestDatabaseReady();

describe.skipIf(!dbReady)('completeOrganizationJoin (integration)', () => {
  const prisma = getTestPrisma();
  const ORG_SLUG = 'test-join-org';

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    await resetJoinTestData(prisma);
    await seedJoinTestOrganization(prisma, ORG_SLUG);
  });

  afterAll(async () => {
    await resetJoinTestData(prisma);
    await prisma.$disconnect();
  });

  it('completes 20 parallel joins for distinct users', async () => {
    const { completeOrganizationJoin } = await import('@/lib/services/join.service');

    const users = await Promise.all(
      Array.from({ length: 20 }, (_, index) => createJoinTestUser(prisma, index))
    );

    const results = await Promise.all(
      users.map((user) => completeOrganizationJoin(ORG_SLUG, user.id, user.email))
    );

    expect(results.every((result) => result.success)).toBe(true);

    const memberCount = await prisma.member.count({
      where: { organization: { slug: ORG_SLUG } },
    });
    expect(memberCount).toBe(20);
  });

  it('treats concurrent duplicate joins for the same user as ALREADY_MEMBER', async () => {
    const { completeOrganizationJoin } = await import('@/lib/services/join.service');
    const user = await createJoinTestUser(prisma, 99);

    const results = await Promise.all(
      Array.from({ length: 8 }, () => completeOrganizationJoin(ORG_SLUG, user.id, user.email))
    );

    const successes = results.filter((result) => result.success);
    const duplicates = results.filter(
      (result) => !result.success && result.error.code === 'ALREADY_MEMBER'
    );

    expect(successes).toHaveLength(1);
    expect(duplicates.length).toBe(7);

    const memberCount = await prisma.member.count({
      where: { organizationId: `test-org-${ORG_SLUG}`, userId: user.id },
    });
    expect(memberCount).toBe(1);
  });
});

if (!dbReady) {
  console.warn(
    '[integration] Test database not available — skipped join integration tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
