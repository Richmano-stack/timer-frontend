import { isAdminRole } from '@/lib/organization/roles';

/**
 * Resolve the post-sign-in destination after active org is set.
 * Mirrors login-form redirect rules: `next` param, then role-based default.
 */
export function resolvePostSignInPath(
  nextPath: string | null | undefined,
  role: string | undefined
): string {
  if (nextPath) {
    return nextPath;
  }

  if (isAdminRole(role)) {
    return '/admin/overview';
  }

  return '/employee/track';
}
