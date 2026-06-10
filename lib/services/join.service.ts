import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { JoinErrorCodes } from '@/lib/errors/join';
import { fail as joinFail } from '@/lib/errors/join-service';
import {
  createDefaultJoinMetadata,
  emailMatchesAllowedDomains,
  parseOrganizationMetadata,
  serializeOrganizationMetadata,
  type OrganizationJoinMetadata,
} from '@/lib/organization/metadata';
import { ServiceResult } from '@/lib/types/api-response';

export interface JoinOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  allowedDomains: string[];
}

export interface JoinSettings {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  allowedDomains: string[];
  joinUrl: string;
}

function resolveJoinMetadata(
  metadata: string | null,
  fallbackEmail?: string
): OrganizationJoinMetadata {
  const parsed = parseOrganizationMetadata(metadata);
  if (parsed) return parsed;
  if (fallbackEmail) return createDefaultJoinMetadata(fallbackEmail);
  return { allowedDomains: [] };
}

export async function getOrganizationBySlug(
  slug: string
): Promise<ServiceResult<JoinOrganizationSummary>> {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const joinMetadata = resolveJoinMetadata(organization.metadata);

  return {
    success: true,
    data: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      allowedDomains: joinMetadata.allowedDomains,
    },
  };
}

export async function validateJoinEmail(
  orgSlug: string,
  email: string
): Promise<ServiceResult<{ organizationId: string; organizationName: string }>> {
  const orgResult = await getOrganizationBySlug(orgSlug);
  if (!orgResult.success) return orgResult;

  const { id, name, allowedDomains } = orgResult.data;

  if (allowedDomains.length === 0) {
    return joinFail(
      JoinErrorCodes.NO_ALLOWED_DOMAINS,
      'This organization has not configured allowed email domains yet.'
    );
  }

  if (!emailMatchesAllowedDomains(email, allowedDomains)) {
    return joinFail(
      JoinErrorCodes.DOMAIN_NOT_ALLOWED,
      `Only work emails from ${allowedDomains.join(', ')} can join this organization.`
    );
  }

  return { success: true, data: { organizationId: id, organizationName: name } };
}

export async function completeOrganizationJoin(
  orgSlug: string,
  userId: string,
  email: string
): Promise<ServiceResult<{ organizationId: string; memberId: string }>> {
  const validation = await validateJoinEmail(orgSlug, email);
  if (!validation.success) return validation;

  const { organizationId } = validation.data;

  const existingMember = await prisma.member.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { id: true },
  });

  if (existingMember) {
    return joinFail(
      JoinErrorCodes.ALREADY_MEMBER,
      'You are already a member of this organization.'
    );
  }

  const member = await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId,
      userId,
      role: 'member',
    },
    select: { id: true, organizationId: true },
  });

  return {
    success: true,
    data: {
      organizationId: member.organizationId,
      memberId: member.id,
    },
  };
}

export async function initializeJoinMetadata(
  organizationId: string,
  ownerEmail: string
): Promise<ServiceResult<OrganizationJoinMetadata>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const existing = parseOrganizationMetadata(organization.metadata);
  if (existing && existing.allowedDomains.length > 0) {
    return { success: true, data: existing };
  }

  const metadata = createDefaultJoinMetadata(ownerEmail);

  await prisma.organization.update({
    where: { id: organizationId },
    data: { metadata: serializeOrganizationMetadata(metadata) },
  });

  return { success: true, data: metadata };
}

export async function getJoinSettingsForAdmin(
  organizationId: string,
  baseUrl: string
): Promise<ServiceResult<JoinSettings>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const joinMetadata = resolveJoinMetadata(organization.metadata);

  return {
    success: true,
    data: {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      allowedDomains: joinMetadata.allowedDomains,
      joinUrl: `${baseUrl}/join/${organization.slug}`,
    },
  };
}

export async function updateJoinSettings(
  organizationId: string,
  allowedDomains: string[]
): Promise<ServiceResult<JoinSettings>> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });

  if (!organization) {
    return joinFail(JoinErrorCodes.ORGANIZATION_NOT_FOUND, 'Organization not found.');
  }

  const current = resolveJoinMetadata(organization.metadata);
  const metadata: OrganizationJoinMetadata = {
    ...current,
    allowedDomains,
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { metadata: serializeOrganizationMetadata(metadata) },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return {
    success: true,
    data: {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      allowedDomains: metadata.allowedDomains,
      joinUrl: `${baseUrl}/join/${organization.slug}`,
    },
  };
}
