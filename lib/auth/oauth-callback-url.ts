/**
 * Build OAuth callback URLs for Better Auth social sign-in.
 * Centralizes query param handling so login/register share the same post-auth flow.
 */
export function buildOAuthCallbackURL(nextPath: string | null | undefined): string {
  if (!nextPath) {
    return '/auth/callback';
  }

  const params = new URLSearchParams({ next: nextPath });
  return `/auth/callback?${params.toString()}`;
}

export function buildOAuthErrorCallbackURL(
  returnPath: '/login' | '/register',
  nextPath?: string | null
): string {
  const params = new URLSearchParams({ error: 'oauth' });
  if (nextPath) {
    params.set('next', nextPath);
  }
  return `${returnPath}?${params.toString()}`;
}

/** OAuth success callback for token-gated invitation join (not /auth/callback). */
export function buildInviteOAuthCallbackURL(token: string): string {
  return `/join/invite/${token}/complete`;
}

export function buildInviteOAuthErrorCallbackURL(token: string): string {
  return `/join/invite/${token}?error=oauth`;
}
