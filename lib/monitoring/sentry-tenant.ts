import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import type { TenantLogFields } from '@/lib/http/request-log';
import { getServerSentryDsn, isSentryEnabled } from '@/lib/monitoring/sentry-dsn';

export type SentryTenantTags = {
  organizationId?: string;
  organizationSlug?: string;
};

export function applySentryTenantTags(tags: SentryTenantTags): void {
  if (!isSentryEnabled(getServerSentryDsn())) {
    return;
  }

  if (tags.organizationId) {
    Sentry.setTag('organizationId', tags.organizationId);
  }

  if (tags.organizationSlug) {
    Sentry.setTag('organizationSlug', tags.organizationSlug);
  }
}

export function clearSentryTenantTags(): void {
  if (!isSentryEnabled(getServerSentryDsn())) {
    return;
  }

  Sentry.setTag('organizationId', undefined);
  Sentry.setTag('organizationSlug', undefined);
}

async function resolveOrganizationSlug(organizationId: string): Promise<string | undefined> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });

  return organization?.slug;
}

async function resolveTenantTags(
  tenant?: TenantLogFields
): Promise<SentryTenantTags | undefined> {
  if (!tenant?.organizationId) {
    return undefined;
  }

  const organizationSlug = await resolveOrganizationSlug(tenant.organizationId);

  return {
    organizationId: tenant.organizationId,
    organizationSlug,
  };
}

/**
 * Report an API-layer fault to Sentry with tenant tags when session context is known.
 */
export async function captureApiServiceError(
  error: unknown,
  tenant?: TenantLogFields
): Promise<void> {
  if (!isSentryEnabled(getServerSentryDsn())) {
    return;
  }

  const tags = await resolveTenantTags(tenant);

  Sentry.withScope((scope) => {
    if (tags?.organizationId) {
      scope.setTag('organizationId', tags.organizationId);
    }
    if (tags?.organizationSlug) {
      scope.setTag('organizationSlug', tags.organizationSlug);
    }
    if (tenant?.userId) {
      scope.setUser({ id: tenant.userId });
    }

    Sentry.captureException(error);
  });
}

function headersToRequest(headers: Record<string, string | string[] | undefined>): Request {
  const normalized = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        normalized.append(key, entry);
      }
    } else {
      normalized.set(key, value);
    }
  }

  return new Request('http://localhost', { headers: normalized });
}

/**
 * Best-effort tenant tags for server-component / middleware faults surfaced via onRequestError.
 */
export async function applySentryTenantFromRequestHeaders(
  headers: Record<string, string | string[] | undefined>
): Promise<void> {
  if (!isSentryEnabled(getServerSentryDsn())) {
    return;
  }

  try {
    const session = await auth.api.getSession({
      headers: headersToRequest(headers),
    });

    const organizationId = session?.session?.activeOrganizationId;
    if (!organizationId) {
      return;
    }

    const organizationSlug = await resolveOrganizationSlug(organizationId);

    applySentryTenantTags({ organizationId, organizationSlug });
  } catch {
    // Tenant enrichment must never block error reporting.
  }
}
