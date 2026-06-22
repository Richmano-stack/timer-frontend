import { fail } from '@/lib/http/api-handler';
import { executeAdminRoute } from '@/lib/http/session-route';
import { JoinErrorCodes } from '@/lib/errors/join';
import {
  getJoinSettingsForAdmin,
  initializeJoinMetadata,
  updateJoinSettings,
} from '@/lib/services/join.service';
import { updateOrganizationSettings } from '@/lib/services/organization-settings.service';
import { updateJoinSettingsSchema } from '@/lib/validators/join';
import { auth } from '@/lib/auth';
import { normalizeDomain, parseOrganizationMetadata } from '@/lib/organization/metadata';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return executeAdminRoute(request, async ({ organizationId }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    const ownerEmail = session?.user?.email;

    if (ownerEmail) {
      await initializeJoinMetadata(organizationId, ownerEmail);
    }

    return getJoinSettingsForAdmin(organizationId, baseUrl);
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateJoinSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      JoinErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const allowedDomains = parsed.data.allowedDomains?.map(normalizeDomain).filter(Boolean);

  return executeAdminRoute(request, async ({ organizationId }) => {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { metadata: true },
    });
    const timezone = parseOrganizationMetadata(organization?.metadata)?.timezone;

    const result = await updateJoinSettings(organizationId, {
      ...(allowedDomains !== undefined ? { allowedDomains } : {}),
      ...(parsed.data.requireApproval !== undefined
        ? { requireApproval: parsed.data.requireApproval }
        : {}),
    });

    if (result.success && timezone) {
      await updateOrganizationSettings(organizationId, { timezone });
    }

    return result;
  });
}
