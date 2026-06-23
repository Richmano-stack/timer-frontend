import '../../../../test/setup/integration-env';
import { describe, expect, it } from 'vitest';
import { isTestDatabaseReady } from '@/test/helpers/test-db';

const dbReady = await isTestDatabaseReady();

describe.skipIf(!dbReady)('GET /api/health (integration)', () => {
  it('returns 200 when Postgres is reachable', async () => {
    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
