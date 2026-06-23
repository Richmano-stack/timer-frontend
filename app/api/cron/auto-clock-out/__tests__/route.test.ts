import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunAutoClockOutJob = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    organizationsProcessed: 2,
    segmentsClosed: 3,
    errors: [],
  })
);

vi.mock('@/lib/env', () => ({
  cronConfig: { secret: 'test-cron-secret' },
}));

vi.mock('@/lib/services/cron-auto-clockout.service', () => ({
  runAutoClockOutJob: mockRunAutoClockOutJob,
}));

describe('POST /api/cron/auto-clock-out', () => {
  beforeEach(() => {
    mockRunAutoClockOutJob.mockClear();
  });

  it('rejects requests without a cron secret', async () => {
    const { POST } = await import('../route');

    const response = await POST(new Request('http://localhost:3000/api/cron/auto-clock-out', {
      method: 'POST',
    }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(mockRunAutoClockOutJob).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid cron secret', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/cron/auto-clock-out', {
        method: 'POST',
        headers: { 'x-cron-secret': 'wrong-secret' },
      })
    );

    expect(response.status).toBe(401);
    expect(mockRunAutoClockOutJob).not.toHaveBeenCalled();
  });

  it('runs the job when x-cron-secret is valid', async () => {
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost:3000/api/cron/auto-clock-out', {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      organizationsProcessed: 2,
      segmentsClosed: 3,
      errors: [],
    });
    expect(mockRunAutoClockOutJob).toHaveBeenCalledOnce();
  });

  it('accepts Authorization Bearer token', async () => {
    const { GET } = await import('../route');

    const response = await GET(
      new Request('http://localhost:3000/api/cron/auto-clock-out', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-cron-secret' },
      })
    );

    expect(response.status).toBe(200);
    expect(mockRunAutoClockOutJob).toHaveBeenCalledOnce();
  });
});
