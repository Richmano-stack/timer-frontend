import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRequestId,
  formatApiRequestLogPayload,
  logApiRequestOutcome,
  runWithApiRequestLogging,
  type ApiRequestLogContext,
} from '@/lib/http/request-log';
import {
  executePublicRoute,
  outcomeFromServiceResult,
  resolveErrorStatus,
} from '@/lib/http/api-handler';

describe('formatApiRequestLogPayload', () => {
  const baseContext: ApiRequestLogContext = {
    requestId: 'req-123',
    method: 'GET',
    path: '/api/health',
    durationMs: 42,
    status: 200,
    success: true,
  };

  it('serializes required fields as single-line JSON', () => {
    const line = formatApiRequestLogPayload(baseContext);
    const parsed = JSON.parse(line);

    expect(parsed).toEqual({
      type: 'api_request',
      requestId: 'req-123',
      method: 'GET',
      path: '/api/health',
      durationMs: 42,
      status: 200,
      success: true,
    });
  });

  it('includes tenant fields when present', () => {
    const line = formatApiRequestLogPayload({
      ...baseContext,
      userId: 'user-1',
      organizationId: 'org-1',
      memberRole: 'admin',
    });
    const parsed = JSON.parse(line);

    expect(parsed.userId).toBe('user-1');
    expect(parsed.organizationId).toBe('org-1');
    expect(parsed.memberRole).toBe('admin');
  });

  it('includes errorCode on failed outcomes', () => {
    const line = formatApiRequestLogPayload({
      ...baseContext,
      success: false,
      status: 401,
      errorCode: 'UNAUTHORIZED',
    });
    const parsed = JSON.parse(line);

    expect(parsed.success).toBe(false);
    expect(parsed.status).toBe(401);
    expect(parsed.errorCode).toBe('UNAUTHORIZED');
  });

  it('omits undefined tenant fields', () => {
    const parsed = JSON.parse(formatApiRequestLogPayload(baseContext));

    expect(parsed).not.toHaveProperty('userId');
    expect(parsed).not.toHaveProperty('organizationId');
    expect(parsed).not.toHaveProperty('memberRole');
    expect(parsed).not.toHaveProperty('errorCode');
  });
});

describe('logApiRequestOutcome', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

  afterEach(() => {
    infoSpy.mockClear();
  });

  it('writes structured JSON via console.info', () => {
    logApiRequestOutcome({
      requestId: 'req-abc',
      method: 'POST',
      path: '/api/time/clock-in',
      userId: 'user-1',
      organizationId: 'org-1',
      memberRole: 'member',
      durationMs: 15,
      status: 200,
      success: true,
    });

    expect(infoSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.requestId).toBe('req-abc');
    expect(payload.durationMs).toBe(15);
  });

  it('does not throw when console.info fails', () => {
    infoSpy.mockImplementationOnce(() => {
      throw new Error('logging backend unavailable');
    });

    expect(() =>
      logApiRequestOutcome({
        requestId: 'req-fail',
        method: 'GET',
        path: '/api/health',
        durationMs: 1,
        status: 200,
        success: true,
      })
    ).not.toThrow();
  });
});

describe('createRequestId', () => {
  it('returns a UUID-shaped identifier', () => {
    expect(createRequestId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

describe('resolveErrorStatus', () => {
  it('maps known error codes to HTTP status', () => {
    expect(resolveErrorStatus('UNAUTHORIZED')).toBe(401);
    expect(resolveErrorStatus('USER_ALREADY_CLOCKED_IN')).toBe(409);
  });

  it('prefers an explicit status override', () => {
    expect(resolveErrorStatus('UNAUTHORIZED', 418)).toBe(418);
  });
});

describe('outcomeFromServiceResult', () => {
  it('derives success outcome from service results', () => {
    expect(outcomeFromServiceResult({ success: true, data: { id: '1' } })).toEqual({
      status: 200,
      success: true,
    });
  });

  it('derives failure outcome with error code', () => {
    expect(
      outcomeFromServiceResult({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Admin access required.' },
      })
    ).toEqual({
      status: 403,
      success: false,
      errorCode: 'FORBIDDEN',
    });
  });
});

describe('runWithApiRequestLogging', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

  beforeEach(() => {
    vi.stubGlobal('performance', { now: vi.fn(() => 1000) });
  });

  afterEach(() => {
    infoSpy.mockClear();
    vi.unstubAllGlobals();
  });

  it('logs request outcome with tenant context from the handler', async () => {
    const request = new Request('https://app.example.com/api/time/status', {
      method: 'GET',
    });

    const response = await runWithApiRequestLogging(request, async () => ({
      response: new Response(JSON.stringify({ success: true }), { status: 200 }),
      outcome: { status: 200, success: true },
      tenant: {
        userId: 'user-1',
        organizationId: 'org-1',
        memberRole: 'member',
      },
    }));

    expect(response.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledOnce();

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.path).toBe('/api/time/status');
    expect(payload.method).toBe('GET');
    expect(payload.userId).toBe('user-1');
    expect(payload.organizationId).toBe('org-1');
    expect(payload.memberRole).toBe('member');
    expect(payload).toHaveProperty('requestId');
    expect(payload).toHaveProperty('durationMs');
  });

  it('logs without tenant fields for unauthenticated failures', async () => {
    const request = new Request('https://app.example.com/api/time/status', {
      method: 'GET',
    });

    await runWithApiRequestLogging(request, async () => ({
      response: new Response(JSON.stringify({ success: false }), { status: 401 }),
      outcome: { status: 401, success: false, errorCode: 'UNAUTHORIZED' },
    }));

    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload).not.toHaveProperty('userId');
    expect(payload.errorCode).toBe('UNAUTHORIZED');
  });
});

describe('executePublicRoute', () => {
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

  afterEach(() => {
    infoSpy.mockClear();
  });

  it('logs public route outcomes without tenant fields', async () => {
    const request = new Request('https://app.example.com/api/health', {
      method: 'GET',
    });

    const response = await executePublicRoute(request, async () =>
      Response.json({ status: 'ok' }, { status: 200 })
    );

    expect(response.status).toBe(200);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0]));
    expect(payload.path).toBe('/api/health');
    expect(payload.success).toBe(true);
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('organizationId');
  });
});
