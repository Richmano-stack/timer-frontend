import '../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetTenantIsolationTestData,
  seedTenantIsolationFixtures,
  type TenantIsolationFixtures,
} from '@/test/helpers/test-db';

const dbReady = await isTestDatabaseReady();

describe.skipIf(!dbReady)('time-tracking clock-in concurrency (integration)', () => {
  const prisma = getTestPrisma();
  let fixtures: TenantIsolationFixtures;

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    await resetTenantIsolationTestData(prisma);
    fixtures = await seedTenantIsolationFixtures(prisma);
  });

  afterAll(async () => {
    await resetTenantIsolationTestData(prisma);
    await prisma.$disconnect();
  });

  it('allows only one open segment when concurrent clock-in attempts race', async () => {
    const { clockInService } = await import('@/lib/services/time-tracking.service');
    const userId = fixtures.tenantA.member.id;
    const organizationId = fixtures.tenantA.organizationId;

    const results = await Promise.all(
      Array.from({ length: 10 }, () => clockInService(userId, organizationId))
    );

    const successes = results.filter((result) => result.success);
    const alreadyClockedIn = results.filter(
      (result) =>
        !result.success &&
        result.error.code === TimeTrackingErrorCodes.USER_ALREADY_CLOCKED_IN
    );

    expect(successes).toHaveLength(1);
    expect(alreadyClockedIn).toHaveLength(9);

    const openCount = await prisma.timeLog.count({
      where: { userId, organizationId, endTime: null },
    });
    expect(openCount).toBe(1);
  });

  it('clock-out closes the single open segment under contention', async () => {
    const { clockInService, clockOutService } = await import(
      '@/lib/services/time-tracking.service'
    );
    const userId = fixtures.tenantA.member.id;
    const organizationId = fixtures.tenantA.organizationId;

    const clockInResult = await clockInService(userId, organizationId);
    expect(clockInResult.success).toBe(true);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => clockOutService(userId, organizationId))
    );

    const successes = results.filter((result) => result.success);
    const notFound = results.filter(
      (result) =>
        !result.success &&
        result.error.code === TimeTrackingErrorCodes.NO_ACTIVE_SESSION_FOUND
    );

    expect(successes).toHaveLength(1);
    expect(notFound).toHaveLength(4);

    const openCount = await prisma.timeLog.count({
      where: { userId, organizationId, endTime: null },
    });
    expect(openCount).toBe(0);
  });
});

if (!dbReady) {
  console.warn(
    '[integration] Test database not available — skipped time-tracking integration tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
