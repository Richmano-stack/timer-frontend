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

  it('returns 429 RATE_LIMITED after too many requests from the same IP', async () => {
    const { POST } = await import('../route');

    let lastStatus = 0;
    for (let index = 0; index < 11; index += 1) {
      const response = await POST(
        new Request('http://localhost:3000/api/join/request-magic-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.99',
          },
          body: JSON.stringify({
            email: `user${index}@example.com`,
            orgSlug: 'demo-company',
          }),
        })
      );
      lastStatus = response.status;
    }

    expect(lastStatus).toBe(429);
    const body = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.99',
        },
        body: JSON.stringify({
          email: 'blocked@example.com',
          orgSlug: 'demo-company',
        }),
      })
    ).then((response) => response.json());

    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.RATE_LIMITED);
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

  it('returns 403 DOMAIN_NOT_ALLOWED for email outside allowlist', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'agent@gmail.com',
          orgSlug: ORG_SLUG,
        }),
      })
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.DOMAIN_NOT_ALLOWED);
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });

  it('returns 404 ORGANIZATION_NOT_FOUND for unknown org slug', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/join/request-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'agent@join-test.local',
          orgSlug: 'missing-org-slug',
        }),
      })
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(JoinErrorCodes.ORGANIZATION_NOT_FOUND);
  });

  it('returns 200 and triggers signInMagicLink for allowed domain', async () => {
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

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationName).toBe('Join Test Org');
    expect(mockSignInMagicLink).toHaveBeenCalledOnce();
    expect(mockSignInMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: 'agent@join-test.local',
          callbackURL: `http://localhost:3000/join/${ORG_SLUG}/complete`,
        }),
      })
    );
  });
});

if (!dbReady) {
  console.warn(
    '[route] Test database not available — skipped DB-backed request-magic-link tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}
