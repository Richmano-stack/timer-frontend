import { prisma } from '@/lib/db/prisma';
import { fail, TimeTrackingErrorCodes } from '@/lib/errors/time-tracking';
import {
  joinPolicyToRequireApproval,
} from '@/lib/organization/join-policy';
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
  timezone: string;
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
    select: { id: true, name: true, slug: true, metadata: true, timezone: true, joinPolicy: true },
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
      timezone: organization.timezone,
      allowedDomains: metadata.allowedDomains,
      requireApproval: joinPolicyToRequireApproval(organization.joinPolicy),
    },
  };
}

export async function updateOrganizationSettings(
  organizationId: string,
  updates: { name?: string; timezone?: string }
): Promise<ServiceResult<OrganizationSettings>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true, timezone: true },
  });

  if (!organization) {
    return fail(TimeTrackingErrorCodes.USER_NOT_IN_COMPANY, 'Organization not found.');
  }

  const currentMetadata = resolveOrganizationMetadata(organization.metadata);
  const data: { name?: string; metadata?: string; timezone?: string } = {};

  if (updates.name !== undefined) {
    data.name = updates.name;
  }

  if (updates.timezone !== undefined) {
    const nextMetadata: OrganizationJoinMetadata = {
      ...currentMetadata,
      timezone: updates.timezone,
    };
    data.metadata = serializeOrganizationMetadata(nextMetadata);
    data.timezone = updates.timezone;
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data,
  });

  return getOrganizationSettingsForAdmin(organizationId);
}
