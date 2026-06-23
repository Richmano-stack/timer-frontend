import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryRaw = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

describe('GET /api/health', () => {
  beforeEach(() => {
    mockQueryRaw.mockClear();
  });

  it('returns 200 with ok status when the database responds', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Object.keys(body).sort()).toEqual(['database', 'status', 'timestamp']);
  });

  it('returns 503 when the database is unreachable', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.status).toBe('error');
    expect(body.database).toBe('error');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
