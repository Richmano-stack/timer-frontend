'use client';

import { authClient } from '@/lib/auth-client';
import { resolvePostSignInPath } from '@/lib/auth/resolve-post-sign-in-path';

export type CompleteSignInResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

/**
 * After any successful sign-in (email or OAuth), pick active org and redirect target.
 */
export async function completeSignInFlow(
  nextPath: string | null | undefined
): Promise<CompleteSignInResult> {
  const orgsResult = await authClient.organization.list();
  const organizations = orgsResult.data ?? [];

  if (organizations.length === 0) {
    return { ok: true, path: '/onboarding' };
  }

  const activeResult = await authClient.organization.setActive({
    organizationId: organizations[0].id,
  });

  if (activeResult.error) {
    return {
      ok: false,
      error: activeResult.error.message ?? 'Failed to set active organization.',
    };
  }

  const roleResult = await authClient.organization.getActiveMemberRole();
  const role = roleResult.data?.role;

  return {
    ok: true,
    path: resolvePostSignInPath(nextPath, role),
  };
}
