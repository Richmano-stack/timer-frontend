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
import { resolveComplianceLimitsFromMetadata } from '@/lib/organization/compliance-limits';
import { ServiceResult } from '@/lib/types/api-response';

export interface OrganizationSettings {
  organizationId: string;
  name: string;
  slug: string;
  timezone: string;
  allowedDomains: string[];
  requireApproval: boolean;
  maxShiftHours: number;
  maxBreakMinutes: number;
  maxLunchMinutes: number;
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
  const complianceLimits = resolveComplianceLimitsFromMetadata(metadata);

  return {
    success: true,
    data: {
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
      allowedDomains: metadata.allowedDomains,
      requireApproval: joinPolicyToRequireApproval(organization.joinPolicy),
      maxShiftHours: complianceLimits.maxShiftHours,
      maxBreakMinutes: complianceLimits.maxBreakMinutes,
      maxLunchMinutes: complianceLimits.maxLunchMinutes,
    },
  };
}

export async function updateOrganizationSettings(
  organizationId: string,
  updates: {
    name?: string;
    timezone?: string;
    maxShiftHours?: number;
    maxBreakMinutes?: number;
    maxLunchMinutes?: number;
  }
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
    currentMetadata.timezone = updates.timezone;
  }

  const complianceUpdates: Partial<
    Pick<OrganizationJoinMetadata, 'maxShiftHours' | 'maxBreakMinutes' | 'maxLunchMinutes'>
  > = {};

  if (updates.maxShiftHours !== undefined) {
    complianceUpdates.maxShiftHours = updates.maxShiftHours;
  }
  if (updates.maxBreakMinutes !== undefined) {
    complianceUpdates.maxBreakMinutes = updates.maxBreakMinutes;
  }
  if (updates.maxLunchMinutes !== undefined) {
    complianceUpdates.maxLunchMinutes = updates.maxLunchMinutes;
  }

  if (Object.keys(complianceUpdates).length > 0) {
    data.metadata = serializeOrganizationMetadata({
      ...currentMetadata,
      ...complianceUpdates,
    });
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data,
  });

  return getOrganizationSettingsForAdmin(organizationId);
}
