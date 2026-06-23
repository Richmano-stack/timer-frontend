import { z } from 'zod';
import {
  fail,
  fromServiceResult,
  outcomeFromServiceResult,
} from '@/lib/http/api-handler';
import { runWithApiRequestLogging } from '@/lib/http/request-log';
import { resolveAdminSessionContext } from '@/lib/security/session-context';
import { buildWorkspaceExport } from '@/lib/services/workspace-export.service';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';

const exportQuerySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
    .optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = exportQuerySchema.safeParse({
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
  });

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { startDate, endDate } = parsed.data;

  return runWithApiRequestLogging(request, async () => {
    const contextResult = await resolveAdminSessionContext(request);
    if (!contextResult.success) {
      return {
        response: fromServiceResult(contextResult),
        outcome: outcomeFromServiceResult(contextResult),
      };
    }

    const { userId, organizationId, memberRole } = contextResult.data;

    try {
      const result = await buildWorkspaceExport(organizationId, {
        startDate,
        endDate,
      });

      if (!result.success) {
        return {
          response: fromServiceResult(result),
          outcome: outcomeFromServiceResult(result),
          tenant: { userId, organizationId, memberRole },
        };
      }

      const { buffer, filename } = result.data;

      return {
        response: new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(buffer.byteLength),
          },
        }),
        outcome: { status: 200, success: true },
        tenant: { userId, organizationId, memberRole },
      };
    } catch (error) {
      console.error('[API] Workspace export failed:', error);
      const response = fail(
        TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
        'An unexpected error occurred. Please try again later.',
        500
      );
      return {
        response,
        outcome: {
          status: 500,
          success: false,
          errorCode: TimeTrackingErrorCodes.INTERNAL_SERVER_ERROR,
        },
        tenant: { userId, organizationId, memberRole },
      };
    }
  });
}
