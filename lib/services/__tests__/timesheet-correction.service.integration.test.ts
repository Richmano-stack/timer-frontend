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

describe.skipIf(!dbReady)('patchTimesheetForAdmin (integration)', () => {
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

  async function seedClosedTimeLog(
    organizationId: string,
    userId: string,
    activityStatusId: string
  ) {
    return prisma.timeLog.create({
      data: {
        organizationId,
        userId,
        activityStatusId,
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T17:00:00.000Z'),
        notes: 'original note',
      },
    });
  }

  it('updates own-tenant time log and writes append-only audit row', async () => {
    const { patchTimesheetForAdmin } = await import(
      '@/lib/services/timesheet-correction.service'
    );
    const timeLog = await seedClosedTimeLog(
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.id,
      fixtures.tenantA.availableStatusId
    );

    const result = await patchTimesheetForAdmin(
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.id,
      timeLog.id,
      {
        reason: 'Correcting missed clock-out',
        clockOut: '2026-06-10T18:00:00.000Z',
      }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.clockOut).toBe('2026-06-10T18:00:00.000Z');

    const updated = await prisma.timeLog.findUnique({
      where: { id: timeLog.id },
    });
    expect(updated?.endTime?.toISOString()).toBe('2026-06-10T18:00:00.000Z');

    const audits = await prisma.timeLogAudit.findMany({
      where: { timeLogId: timeLog.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.reason).toBe('Correcting missed clock-out');
    expect(audits[0]?.actorUserId).toBe(fixtures.tenantA.admin.id);
    expect(audits[0]?.organizationId).toBe(fixtures.tenantA.organizationId);
    expect(audits[0]?.before).toMatchObject({
      endTime: '2026-06-10T17:00:00.000Z',
    });
    expect(audits[0]?.after).toMatchObject({
      endTime: '2026-06-10T18:00:00.000Z',
    });
  });

  it('returns TIMELOG_NOT_FOUND for cross-tenant timeLogId', async () => {
    const { patchTimesheetForAdmin } = await import(
      '@/lib/services/timesheet-correction.service'
    );
    const tenantBLog = await seedClosedTimeLog(
      fixtures.tenantB.organizationId,
      fixtures.tenantB.member.id,
      fixtures.tenantB.availableStatusId
    );

    const result = await patchTimesheetForAdmin(
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.id,
      tenantBLog.id,
      {
        reason: 'Attempted cross-tenant edit',
        notes: 'should not apply',
      }
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(TimeTrackingErrorCodes.TIMELOG_NOT_FOUND);

    const unchanged = await prisma.timeLog.findUnique({
      where: { id: tenantBLog.id },
    });
    expect(unchanged?.notes).toBe('original note');

    const auditCount = await prisma.timeLogAudit.count({
      where: { timeLogId: tenantBLog.id },
    });
    expect(auditCount).toBe(0);
  });

  it('exposes manuallyEdited on GET timesheets after correction', async () => {
    const { patchTimesheetForAdmin } = await import(
      '@/lib/services/timesheet-correction.service'
    );
    const { getTimesheetsService } = await import(
      '@/lib/services/admin-dashboard.service'
    );
    const timeLog = await seedClosedTimeLog(
      fixtures.tenantA.organizationId,
      fixtures.tenantA.member.id,
      fixtures.tenantA.availableStatusId
    );

    const patchResult = await patchTimesheetForAdmin(
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.id,
      timeLog.id,
      {
        reason: 'Adjusting clock-in time',
        clockIn: '2026-06-10T08:30:00.000Z',
      }
    );
    expect(patchResult.success).toBe(true);

    const sheets = await getTimesheetsService(
      fixtures.tenantA.organizationId,
      '2026-06-10',
      '2026-06-10'
    );
    expect(sheets.success).toBe(true);
    if (!sheets.success) return;

    const row = sheets.data.rows.find((entry) => entry.timeLogId === timeLog.id);
    expect(row).toBeDefined();
    expect(row?.manuallyEdited).toBe(true);
  });
});

describe.skipIf(!dbReady)('listTimeLogAuditsForAdmin (integration)', () => {
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

  it('lists audits for own-tenant time log ordered newest first', async () => {
    const { patchTimesheetForAdmin, listTimeLogAuditsForAdmin } = await import(
      '@/lib/services/timesheet-correction.service'
    );

    const timeLog = await prisma.timeLog.create({
      data: {
        organizationId: fixtures.tenantA.organizationId,
        userId: fixtures.tenantA.member.id,
        activityStatusId: fixtures.tenantA.availableStatusId,
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T17:00:00.000Z'),
        notes: 'original note',
      },
    });

    await patchTimesheetForAdmin(
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.id,
      timeLog.id,
      { reason: 'First correction pass', clockOut: '2026-06-10T18:00:00.000Z' }
    );
    await patchTimesheetForAdmin(
      fixtures.tenantA.organizationId,
      fixtures.tenantA.admin.id,
      timeLog.id,
      { reason: 'Second correction pass', notes: 'updated note' }
    );

    const result = await listTimeLogAuditsForAdmin(
      fixtures.tenantA.organizationId,
      timeLog.id
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.audits).toHaveLength(2);
    expect(result.data.audits[0]?.reason).toBe('Second correction pass');
    expect(result.data.audits[1]?.reason).toBe('First correction pass');
    expect(result.data.audits[0]?.actorLabel).toBeTruthy();
    expect(result.data.audits[0]?.before.endTime).toBe('2026-06-10T18:00:00.000Z');
  });

  it('returns TIMELOG_NOT_FOUND for cross-tenant timeLogId', async () => {
    const { listTimeLogAuditsForAdmin } = await import(
      '@/lib/services/timesheet-correction.service'
    );

    const tenantBLog = await prisma.timeLog.create({
      data: {
        organizationId: fixtures.tenantB.organizationId,
        userId: fixtures.tenantB.member.id,
        activityStatusId: fixtures.tenantB.availableStatusId,
        startTime: new Date('2026-06-10T09:00:00.000Z'),
        endTime: new Date('2026-06-10T17:00:00.000Z'),
      },
    });

    const result = await listTimeLogAuditsForAdmin(
      fixtures.tenantA.organizationId,
      tenantBLog.id
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(TimeTrackingErrorCodes.TIMELOG_NOT_FOUND);
  });
});
