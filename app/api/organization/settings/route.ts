import { fail } from '@/lib/http/api-handler';
import { executeAdminRoute } from '@/lib/http/session-route';
import { TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  getOrganizationSettingsForAdmin,
  updateOrganizationSettings,
} from '@/lib/services/organization-settings.service';
import { updateOrganizationSettingsSchema } from '@/lib/validators/organization-settings';

export async function GET(request: Request) {
  return executeAdminRoute(request, ({ organizationId }) =>
    getOrganizationSettingsForAdmin(organizationId)
  );
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateOrganizationSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      TimeTrackingErrorCodes.VALIDATION_ERROR,
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  return executeAdminRoute(request, ({ organizationId }) =>
    updateOrganizationSettings(organizationId, parsed.data)
  );
}
