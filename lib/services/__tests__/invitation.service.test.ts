import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationErrorCodes } from '@/lib/errors/invitation';

const {
  mockInvitationFindMany,
  mockInvitationFindFirst,
  mockInvitationCreate,
  mockInvitationUpdate,
  mockMemberFindFirst,
  mockOrganizationFindFirst,
  mockUserFindFirst,
  mockSendInvitationEmail,
  mockAuditInvitationSent,
} = vi.hoisted(() => ({
  mockInvitationFindMany: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationCreate: vi.fn(),
  mockInvitationUpdate: vi.fn(),
  mockMemberFindFirst: vi.fn(),
  mockOrganizationFindFirst: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockSendInvitationEmail: vi.fn(),
  mockAuditInvitationSent: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    invitation: {
      findMany: mockInvitationFindMany,
      findFirst: mockInvitationFindFirst,
      create: mockInvitationCreate,
      update: mockInvitationUpdate,
    },
    member: {
      findFirst: mockMemberFindFirst,
    },
    organization: {
      findFirst: mockOrganizationFindFirst,
    },
    user: {
      findFirst: mockUserFindFirst,
    },
  },
}));

vi.mock('@/lib/email/send', () => ({
  sendInvitationEmail: mockSendInvitationEmail,
}));

vi.mock('@/lib/db/audit', () => ({
  auditInvitationSent: mockAuditInvitationSent,
}));

import {
  createInvitationForAdmin,
  listPendingInvitationsForAdmin,
  revokeInvitationForAdmin,
} from '@/lib/services/invitation.service';

const ORG_ID = 'org-123';
const INVITER_ID = 'user-inviter';
const INVITATION_ID = 'invitation-123';
const NOW = new Date('2026-06-22T12:00:00.000Z');

const pendingInvitation = {
  id: INVITATION_ID,
  email: 'agent@example.com',
  role: 'member',
  status: 'pending',
  expiresAt: new Date('2026-06-29T12:00:00.000Z'),
  createdAt: NOW,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com';
  mockMemberFindFirst.mockResolvedValue(null);
  mockInvitationFindFirst.mockResolvedValue(null);
  mockOrganizationFindFirst.mockResolvedValue({ name: 'Acme Call Center' });
  mockUserFindFirst.mockResolvedValue({ name: 'Admin User' });
  mockSendInvitationEmail.mockResolvedValue(undefined);
  mockAuditInvitationSent.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe('createInvitationForAdmin', () => {
  it('creates invitation, sends email, and records audit', async () => {
    mockInvitationCreate.mockResolvedValue(pendingInvitation);

    const result = await createInvitationForAdmin(
      ORG_ID,
      INVITER_ID,
      'owner',
      'agent@example.com',
      'member'
    );

    expect(result.success).toBe(true);
    expect(mockSendInvitationEmail).toHaveBeenCalledWith('agent@example.com', {
      url: 'https://app.example.com/join/invite/invitation-123',
      orgName: 'Acme Call Center',
      inviterName: 'Admin User',
      expiresAt: pendingInvitation.expiresAt,
    });
    expect(mockAuditInvitationSent).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      actorUserId: INVITER_ID,
      invitationId: INVITATION_ID,
      metadata: {
        email: 'agent@example.com',
        role: 'member',
      },
    });
  });

  it('returns success when email send fails', async () => {
    mockInvitationCreate.mockResolvedValue(pendingInvitation);
    mockSendInvitationEmail.mockRejectedValue(new Error('Resend unavailable'));

    const result = await createInvitationForAdmin(
      ORG_ID,
      INVITER_ID,
      'owner',
      'agent@example.com',
      'member'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(INVITATION_ID);
    }
  });
});

describe('listPendingInvitationsForAdmin', () => {
  it('returns pending non-expired invitations scoped to organization', async () => {
    mockInvitationFindMany.mockResolvedValue([pendingInvitation]);

    const result = await listPendingInvitationsForAdmin(ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([
        {
          id: INVITATION_ID,
          email: 'agent@example.com',
          role: 'member',
          status: 'pending',
          expiresAt: '2026-06-29T12:00:00.000Z',
          createdAt: '2026-06-22T12:00:00.000Z',
        },
      ]);
    }

    expect(mockInvitationFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        status: 'pending',
        expiresAt: { gt: NOW },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  });

  it('returns an empty array when no pending invitations exist', async () => {
    mockInvitationFindMany.mockResolvedValue([]);

    const result = await listPendingInvitationsForAdmin(ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});

describe('revokeInvitationForAdmin', () => {
  it('revokes a pending invitation for the active organization', async () => {
    mockInvitationFindFirst.mockResolvedValue(pendingInvitation);
    mockInvitationUpdate.mockResolvedValue({
      ...pendingInvitation,
      status: 'revoked',
    });

    const result = await revokeInvitationForAdmin(ORG_ID, INVITATION_ID, 'owner');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('revoked');
    }

    expect(mockInvitationFindFirst).toHaveBeenCalledWith({
      where: {
        id: INVITATION_ID,
        organizationId: ORG_ID,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    expect(mockInvitationUpdate).toHaveBeenCalledWith({
      where: { id: INVITATION_ID },
      data: { status: 'revoked' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  });

  it('returns INVITATION_NOT_FOUND when invitation is missing or cross-tenant', async () => {
    mockInvitationFindFirst.mockResolvedValue(null);

    const result = await revokeInvitationForAdmin(ORG_ID, INVITATION_ID, 'owner');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(InvitationErrorCodes.INVITATION_NOT_FOUND);
    }
    expect(mockInvitationUpdate).not.toHaveBeenCalled();
  });

  it('returns INVITATION_NOT_REVOCABLE when invitation is already revoked', async () => {
    mockInvitationFindFirst.mockResolvedValue({
      ...pendingInvitation,
      status: 'revoked',
    });

    const result = await revokeInvitationForAdmin(ORG_ID, INVITATION_ID, 'owner');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(InvitationErrorCodes.INVITATION_NOT_REVOCABLE);
    }
    expect(mockInvitationUpdate).not.toHaveBeenCalled();
  });

  it('returns INVITATION_NOT_REVOCABLE when invitation is already accepted', async () => {
    mockInvitationFindFirst.mockResolvedValue({
      ...pendingInvitation,
      status: 'accepted',
    });

    const result = await revokeInvitationForAdmin(ORG_ID, INVITATION_ID, 'owner');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(InvitationErrorCodes.INVITATION_NOT_REVOCABLE);
    }
    expect(mockInvitationUpdate).not.toHaveBeenCalled();
  });
});
