import { AuthErrorCodes } from '@/lib/errors/auth';
import { prisma } from '@/lib/db/prisma';
import { validateInvitationForJoin } from '@/lib/services/join.service';
import { ServiceResult } from '@/lib/types/api-response';

export type RegistrationIntent = 'owner_bootstrap' | 'invitation';

const REGISTRATION_DENIED_MESSAGE =
  'Registration is restricted. Business owners can create a workspace at /register. Employees must join through an invitation link.';

function fail(code: string, message: string): ServiceResult<void> {
  return { success: false, error: { code, message } };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isInvitationExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}

export async function hasPendingInvitationForEmail(email: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const invitation = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  return invitation !== null;
}

export async function assertRegistrationAllowed(
  email: string,
  intent: RegistrationIntent,
  invitationToken?: string
): Promise<ServiceResult<void>> {
  const normalizedEmail = normalizeEmail(email);

  if (intent === 'owner_bootstrap') {
    return { success: true, data: undefined };
  }

  if (!invitationToken?.trim()) {
    return fail(
      AuthErrorCodes.INVITATION_REQUIRED,
      'A valid invitation token is required to register.'
    );
  }

  const validation = await validateInvitationForJoin(
    invitationToken.trim(),
    normalizedEmail
  );

  if (!validation.success) {
    return fail(
      AuthErrorCodes.INVITATION_INVALID,
      validation.error.message
    );
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationToken.trim() },
    select: { status: true, expiresAt: true },
  });

  if (
    !invitation ||
    invitation.status !== 'pending' ||
    isInvitationExpired(invitation.expiresAt)
  ) {
    return fail(
      AuthErrorCodes.INVITATION_INVALID,
      'This invitation is no longer valid.'
    );
  }

  return { success: true, data: undefined };
}

export function registrationDeniedResult(): ServiceResult<void> {
  return fail(AuthErrorCodes.REGISTRATION_NOT_ALLOWED, REGISTRATION_DENIED_MESSAGE);
}

export function isOwnerOAuthCallbackURL(callbackURL: string | undefined): boolean {
  if (!callbackURL?.trim()) {
    return false;
  }

  try {
    const url = new URL(callbackURL, 'http://localhost');
    return url.pathname === '/auth/callback' && !url.searchParams.has('next');
  } catch {
    return false;
  }
}

const INVITE_COMPLETE_PATH = /^\/join\/invite\/([^/]+)\/complete$/;

export function parseInviteTokenFromOAuthCallback(
  callbackURL: string | undefined
): string | null {
  if (!callbackURL?.trim()) {
    return null;
  }

  try {
    const url = new URL(callbackURL, 'http://localhost');
    const match = url.pathname.match(INVITE_COMPLETE_PATH);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isInviteOAuthCallbackURL(callbackURL: string | undefined): boolean {
  return parseInviteTokenFromOAuthCallback(callbackURL) !== null;
}
