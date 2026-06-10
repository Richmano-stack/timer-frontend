import { auth } from '@/lib/auth';
import { executeAdminRoute } from '@/lib/http/session-route';
import { initializeJoinMetadata } from '@/lib/services/join.service';
import { seedDefaultActivityStatuses } from '@/lib/services/organization-bootstrap.service';

export async function POST(request: Request) {
  return executeAdminRoute(request, async ({ organizationId }) => {
    const seedResult = await seedDefaultActivityStatuses(organizationId);
    if (!seedResult.success) return seedResult;

    const session = await auth.api.getSession({ headers: request.headers });
    const ownerEmail = session?.user?.email;

    if (ownerEmail) {
      const joinResult = await initializeJoinMetadata(organizationId, ownerEmail);
      if (!joinResult.success) return joinResult;
    }

    return {
      success: true,
      data: {
        seeded: seedResult.data.seeded,
        joinMetadataInitialized: Boolean(ownerEmail),
      },
    };
  });
}
