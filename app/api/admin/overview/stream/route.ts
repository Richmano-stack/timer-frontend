import { fromServiceResult, outcomeFromServiceResult } from '@/lib/http/api-handler';
import { runWithApiRequestLogging } from '@/lib/http/request-log';
import { resolveAdminSessionContext } from '@/lib/security/session-context';
import { getAdminOverviewService } from '@/lib/services/admin-dashboard.service';

const STREAM_INTERVAL_MS = 5_000;

export async function GET(request: Request) {
  return runWithApiRequestLogging(request, async () => {
    const contextResult = await resolveAdminSessionContext(request);
    if (!contextResult.success) {
      return {
        response: fromServiceResult(contextResult),
        outcome: outcomeFromServiceResult(contextResult),
      };
    }

    const { organizationId, userId, memberRole } = contextResult.data;
    const encoder = new TextEncoder();
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isClosed = false;

    const stream = new ReadableStream({
      start(controller) {
        const pushOverview = async () => {
          if (isClosed) return;

          try {
            const result = await getAdminOverviewService(organizationId);
            if (isClosed) return;

            if (result.success) {
              const payload = JSON.stringify({ success: true, data: result.data });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          } catch {
            // Skip failed ticks; client falls back to polling.
          }
        };

        const cleanup = () => {
          if (isClosed) return;
          isClosed = true;
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          try {
            controller.close();
          } catch {
            // Stream may already be closed.
          }
        };

        request.signal.addEventListener('abort', cleanup);

        void pushOverview();
        intervalId = setInterval(() => {
          void pushOverview();
        }, STREAM_INTERVAL_MS);
      },
      cancel() {
        isClosed = true;
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
      },
    });

    return {
      response: new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      }),
      outcome: { status: 200, success: true },
      tenant: { userId, organizationId, memberRole },
    };
  });
}
