import { prisma } from '@/lib/db/prisma';

export interface ResolvedInvitation {
  id: string;
  email: string;
  organizationName: string;
  organizationId: string;
  role: string;
}

export async function resolveInvitationToken(
  token: string
): Promise<ResolvedInvitation | null> {
  const invitation = await prisma.invitation.findUnique({
    where: { id: token },
    include: {
      organization: {
        select: { name: true },
      },
    },
  });

  if (!invitation) {
    return null;
  }

  if (invitation.status !== 'pending') {
    return null;
  }

  if (invitation.expiresAt <= new Date()) {
    return null;
  }

  return {
    id: invitation.id,
    email: invitation.email,
    organizationName: invitation.organization.name,
    organizationId: invitation.organizationId,
    role: invitation.role,
  };
}
