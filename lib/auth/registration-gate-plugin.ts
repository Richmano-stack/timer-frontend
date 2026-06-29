import type { BetterAuthPlugin } from 'better-auth';
import { APIError } from 'better-auth/api';
import {
  hasPendingInvitationForEmail,
  isInviteOAuthCallbackURL,
  isOwnerOAuthCallbackURL,
} from '@/lib/auth/registration-policy';
import {
  grantRegistrationPermit,
  hasActiveRegistrationPermit,
} from '@/lib/auth/registration-permit';
import { validateJoinEmail } from '@/lib/services/join.service';

const REGISTRATION_DENIED_MESSAGE =
  'Registration is restricted. Business owners can create a workspace at /register. Employees must join through an invitation link.';

export function registrationGatePlugin(): BetterAuthPlugin {
  return {
    id: 'registration-gate',
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === '/sign-in/magic-link',
          handler: async (ctx) => {
            const email = ctx.body?.email?.trim().toLowerCase();
            const orgSlug = ctx.body?.metadata?.orgSlug;

            if (!email || typeof orgSlug !== 'string' || !orgSlug.trim()) {
              throw new APIError('FORBIDDEN', {
                message:
                  'Magic link sign-in requires a validated organization join context.',
              });
            }

            const validation = await validateJoinEmail(orgSlug.trim(), email);
            if (!validation.success) {
              throw new APIError('FORBIDDEN', {
                message: validation.error.message,
              });
            }

            grantRegistrationPermit(email, 'join_magic_link');
          },
        },
        {
          matcher: (ctx) => ctx.path === '/sign-up/email',
          handler: async (ctx) => {
            const email = ctx.body?.email?.trim().toLowerCase();
            if (!email) {
              throw new APIError('FORBIDDEN', { message: REGISTRATION_DENIED_MESSAGE });
            }

            const allowed =
              hasActiveRegistrationPermit(email) ||
              (await hasPendingInvitationForEmail(email));

            if (!allowed) {
              throw new APIError('FORBIDDEN', { message: REGISTRATION_DENIED_MESSAGE });
            }
          },
        },
        {
          matcher: (ctx) => ctx.path === '/sign-in/social' && ctx.body?.requestSignUp === true,
          handler: async (ctx) => {
            const callbackURL = ctx.body?.callbackURL as string | undefined;
            const allowed =
              isOwnerOAuthCallbackURL(callbackURL) ||
              isInviteOAuthCallbackURL(callbackURL);

            if (!allowed) {
              throw new APIError('FORBIDDEN', {
                message:
                  'Google sign-up is only available when creating a new workspace or accepting an invitation.',
              });
            }
          },
        },
      ],
    },
  };
}

export async function assertUserCreationAllowed(
  email: string,
  path: string | undefined
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  if (path?.startsWith('/callback/')) {
    return;
  }

  if (path === '/magic-link/verify') {
    if (!hasActiveRegistrationPermit(normalizedEmail)) {
      throw new APIError('FORBIDDEN', { message: REGISTRATION_DENIED_MESSAGE });
    }
    return;
  }

  if (hasActiveRegistrationPermit(normalizedEmail)) {
    return;
  }

  if (await hasPendingInvitationForEmail(normalizedEmail)) {
    return;
  }

  throw new APIError('FORBIDDEN', { message: REGISTRATION_DENIED_MESSAGE });
}
