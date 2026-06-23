export interface ApiRequestLogContext {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
  organizationId?: string;
  memberRole?: string;
  durationMs: number;
  status: number;
  success: boolean;
  errorCode?: string;
}

export type TenantLogFields = Pick<
  ApiRequestLogContext,
  'userId' | 'organizationId' | 'memberRole'
>;

export type ApiRequestOutcome = Pick<
  ApiRequestLogContext,
  'status' | 'success' | 'errorCode'
>;

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function formatApiRequestLogPayload(ctx: ApiRequestLogContext): string {
  const payload: Record<string, unknown> = {
    type: 'api_request',
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    durationMs: ctx.durationMs,
    status: ctx.status,
    success: ctx.success,
  };

  if (ctx.userId !== undefined) payload.userId = ctx.userId;
  if (ctx.organizationId !== undefined) payload.organizationId = ctx.organizationId;
  if (ctx.memberRole !== undefined) payload.memberRole = ctx.memberRole;
  if (ctx.errorCode !== undefined) payload.errorCode = ctx.errorCode;

  return JSON.stringify(payload);
}

export function logApiRequestOutcome(ctx: ApiRequestLogContext): void {
  try {
    console.info(formatApiRequestLogPayload(ctx));
  } catch {
    // Logging must never break API responses.
  }
}

type ApiRequestLoggingResult = {
  response: Response;
  outcome: ApiRequestOutcome;
  tenant?: TenantLogFields;
};

export async function runWithApiRequestLogging(
  request: Request,
  fn: () => Promise<ApiRequestLoggingResult>
): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = performance.now();
  const method = request.method;
  const path = new URL(request.url).pathname;

  let outcome: ApiRequestOutcome | undefined;
  let tenant: TenantLogFields | undefined;

  try {
    const result = await fn();
    outcome = result.outcome;
    tenant = result.tenant;
    return result.response;
  } catch (error) {
    outcome = { status: 500, success: false, errorCode: 'INTERNAL_SERVER_ERROR' };
    throw error;
  } finally {
    if (outcome) {
      logApiRequestOutcome({
        requestId,
        method,
        path,
        userId: tenant?.userId,
        organizationId: tenant?.organizationId,
        memberRole: tenant?.memberRole,
        durationMs: Math.round(performance.now() - startedAt),
        ...outcome,
      });
    }
  }
}
