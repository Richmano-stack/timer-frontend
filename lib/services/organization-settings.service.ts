import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  parseOrganizationMetadata,
  serializeOrganizationMetadata,
  type OrganizationJoinMetadata,
} from '@/lib/organization/metadata';
import { ServiceResult } from '@/lib/types/api-response';

export interface OrganizationSettings {
  organizationId: string;
  name: string;
  slug: string;
  timezone: string | null;
  allowedDomains: string[];
  requireApproval: boolean;
}

function resolveOrganizationMetadata(raw: string | null | undefined): OrganizationJoinMetadata {
  return parseOrganizationMetadata(raw) ?? { allowedDomains: [] };
}

export async function getOrganizationSettingsForAdmin(
  organizationId: string
): Promise<ServiceResult<OrganizationSettings>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  const metadata = resolveOrganizationMetadata(organization.metadata);

  return {
    success: true,
    data: {
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: metadata.timezone ?? null,
      allowedDomains: metadata.allowedDomains,
      requireApproval: metadata.requireApproval === true,
    },
  };
}

export async function updateOrganizationSettings(
  organizationId: string,
  updates: { name?: string; timezone?: string }
): Promise<ServiceResult<OrganizationSettings>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  const currentMetadata = resolveOrganizationMetadata(organization.metadata);
  const data: { name?: string; metadata?: string } = {};

  if (updates.name !== undefined) {
    data.name = updates.name;
  }

  if (updates.timezone !== undefined) {
    const nextMetadata: OrganizationJoinMetadata = {
      ...currentMetadata,
      timezone: updates.timezone,
    };
    data.metadata = serializeOrganizationMetadata(nextMetadata);
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data,
  });

  return getOrganizationSettingsForAdmin(organizationId);
}
