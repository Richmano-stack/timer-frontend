import '../../../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_CLOCK_OUT_NOTE,
  DEFAULT_MAX_SHIFT_HOURS,
} from '@/lib/services/cron-auto-clockout.service';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetTenantIsolationTestData,
  seedTenantIsolationFixtures,
  type TenantIsolationFixtures,
} from '@/test/helpers/test-db';

process.env.CRON_SECRET = 'integration-cron-secret';

const dbReady = await isTestDatabaseReady();

describe.skipIf(!dbReady)('POST /api/cron/auto-clock-out (integration)', () => {
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

  it('closes stale open segments and is idempotent on re-run', async () => {
    const staleStart = new Date(
      Date.now() - (DEFAULT_MAX_SHIFT_HOURS + 1) * 60 * 60 * 1000
    );
    const recentStart = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const staleSegment = await prisma.timeLog.create({
      data: {
        userId: fixtures.tenantA.member.id,
        organizationId: fixtures.tenantA.organizationId,
        activityStatusId: fixtures.tenantA.availableStatusId,
        startTime: staleStart,
        endTime: null,
      },
    });

    await prisma.timeLog.create({
      data: {
        userId: fixtures.tenantA.admin.id,
        organizationId: fixtures.tenantA.organizationId,
        activityStatusId: fixtures.tenantA.availableStatusId,
        startTime: recentStart,
        endTime: null,
      },
    });

    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/cron/auto-clock-out', {
        method: 'POST',
        headers: { 'x-cron-secret': 'integration-cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationsProcessed).toBeGreaterThanOrEqual(1);
    expect(body.data.segmentsClosed).toBe(1);
    expect(body.data.errors).toEqual([]);

    const closed = await prisma.timeLog.findFirst({
      where: {
        id: staleSegment.id,
        organizationId: fixtures.tenantA.organizationId,
      },
    });

    expect(closed?.endTime).not.toBeNull();
    expect(closed?.notes).toContain(AUTO_CLOCK_OUT_NOTE);

    const stillOpen = await prisma.timeLog.count({
      where: {
        organizationId: fixtures.tenantA.organizationId,
        endTime: null,
      },
    });
    expect(stillOpen).toBe(1);

    const rerun = await POST(
      new Request('http://localhost:3000/api/cron/auto-clock-out', {
        method: 'POST',
        headers: { 'x-cron-secret': 'integration-cron-secret' },
      })
    );

    const rerunBody = await rerun.json();
    expect(rerunBody.data.segmentsClosed).toBe(0);
  });

  it('rejects unauthorized cron requests', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/cron/auto-clock-out', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
  });
});

if (!dbReady) {
  console.warn(
    '[integration] Test database not available — skipped cron auto-clock-out integration tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
