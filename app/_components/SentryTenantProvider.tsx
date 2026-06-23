'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { getClientSentryDsn, isSentryEnabled } from '@/lib/monitoring/sentry-dsn';

/**
 * Attach multi-tenant tags to client-side Sentry events when the session has an active org.
 */
export function SentryTenantProvider() {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (!isSentryEnabled(getClientSentryDsn())) {
      return;
    }

    const organizationId = session?.session?.activeOrganizationId;
    if (!organizationId) {
      Sentry.setTag('organizationId', undefined);
      Sentry.setTag('organizationSlug', undefined);
      return;
    }

    let cancelled = false;

    void (async () => {
      const orgsResult = await authClient.organization.list();
      if (cancelled) return;

      const organization = orgsResult.data?.find((org) => org.id === organizationId);

      Sentry.setTag('organizationId', organizationId);
      Sentry.setTag('organizationSlug', organization?.slug ?? undefined);

      if (session.user?.id) {
        Sentry.setUser({ id: session.user.id });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  return null;
}
