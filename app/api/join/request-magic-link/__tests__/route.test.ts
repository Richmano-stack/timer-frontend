import '../../../../../test/setup/integration-env';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinErrorCodes } from '@/lib/errors/join';
import { resetJoinRateLimitsForTests } from '@/lib/security/join-rate-limit';
import {
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetJoinTestData,
  seedJoinTestOrganization,
} from '@/test/helpers/test-db';

const mockSignInMagicLink = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signInMagicLink: mockSignInMagicLink,
    },
  },
}));

const dbReady = await isTestDatabaseReady();

describe('POST /api/join/request-magic-link', () => {
  beforeEach(() => {
    mockSignInMagicLink.mockClear();
    resetJoinRateLimitsForTests();
  });

  it('returns 400 VALIDATION_ERROR for invalid email', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', orgSlug: 'demo-company' }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.VALIDATION_ERROR);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when orgSlug is missing', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'agent@example.com' }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.VALIDATION_ERROR);
  });

  it('returns 410 INVITATION_REQUIRED for valid slug magic-link requests', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.99',
        },
        body: JSON.stringify({
          email: 'agent@example.com',
          orgSlug: 'demo-company',
        }),
      })
    );

    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.INVITATION_REQUIRED);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for invalid JSON body', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.VALIDATION_ERROR);
  });
});

describe.skipIf(!dbReady)('POST /api/join/request-magic-link (database)', () => {
  const prisma = getTestPrisma();
  const ORG_SLUG = 'test-join-route';

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    mockSignInMagicLink.mockClear();
    resetJoinRateLimitsForTests();
    await resetJoinTestData(prisma);
    await seedJoinTestOrganization(prisma, ORG_SLUG);
  });

  it('returns 410 INVITATION_REQUIRED for slug-only magic link requests', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'agent@join-test.local',
          orgSlug: ORG_SLUG,
        }),
      })
    );

    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.INVITATION_REQUIRED);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });
});

if (!dbReady) {
  console.warn(
    '[route] Test database not available — skipped DB-backed request-magic-link tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
