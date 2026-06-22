import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationErrorCodes } from '@/lib/errors/invitation';

const {
  mockInvitationFindMany,
  mockInvitationFindFirst,
  mockInvitationUpdate,
} = vi.hoisted(() => ({
  mockInvitationFindMany: vi.fn(),
  mockInvitationFindFirst: vi.fn(),
  mockInvitationUpdate: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    invitation: {
      findMany: mockInvitationFindMany,
      findFirst: mockInvitationFindFirst,
      update: mockInvitationUpdate,
    },
  },
}));

import {
  listPendingInvitationsForAdmin,
  revokeInvitationForAdmin,
} from '@/lib/services/invitation.service';

const ORG_ID = 'org-123';
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
});

afterEach(() => {
  vi.useRealTimers();
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
