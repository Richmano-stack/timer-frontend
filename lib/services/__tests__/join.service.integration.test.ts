import '../../../test/setup/integration-env';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createJoinTestUser,
  createJoinTestInviter,
  getTestPrisma,
  isTestDatabaseReady,
  migrateTestDatabase,
  resetJoinTestData,
  seedJoinTestInvitation,
  seedJoinTestOrganization,
} from '@/test/helpers/test-db';
import { serializeOrganizationMetadata } from '@/lib/organization/metadata';

const dbReady = await isTestDatabaseReady();

describe.skipIf(!dbReady)('completeJoinWithApprovedRequest (integration)', () => {
  const prisma = getTestPrisma();
  const ORG_SLUG = 'test-join-org';

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    await resetJoinTestData(prisma);
    await seedJoinTestOrganization(prisma, ORG_SLUG);
  });

  afterAll(async () => {
    await resetJoinTestData(prisma);
    await prisma.$disconnect();
  });

  async function seedApprovedJoinRequest(
    organizationId: string,
    email: string,
    userId: string
  ) {
    return prisma.joinRequest.create({
      data: {
        organizationId,
        email,
        userId,
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });
  }

  it('completes 20 parallel joins for distinct users with approved requests', async () => {
    const { completeJoinWithApprovedRequest } = await import('@/lib/services/join.service');
    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });

    const users = await Promise.all(
      Array.from({ length: 20 }, (_, index) => createJoinTestUser(prisma, index))
    );

    await Promise.all(
      users.map((user) =>
        seedApprovedJoinRequest(org!.id, user.email, user.id)
      )
    );

    const results = await Promise.all(
      users.map((user) => completeJoinWithApprovedRequest(org!.id, user.id, user.email))
    );

    expect(results.every((result) => result.success)).toBe(true);

    const memberCount = await prisma.member.count({
      where: { organization: { slug: ORG_SLUG } },
    });
    expect(memberCount).toBe(20);
  });

  it('treats concurrent duplicate joins for the same user as ALREADY_MEMBER', async () => {
    const { completeJoinWithApprovedRequest } = await import('@/lib/services/join.service');
    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    const user = await createJoinTestUser(prisma, 99);

    await seedApprovedJoinRequest(org!.id, user.email, user.id);

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        completeJoinWithApprovedRequest(org!.id, user.id, user.email)
      )
    );

    const successes = results.filter((result) => result.success);
    const duplicates = results.filter(
      (result) => !result.success && result.error.code === 'ALREADY_MEMBER'
    );

    expect(successes).toHaveLength(1);
    expect(duplicates.length).toBe(7);

    const memberCount = await prisma.member.count({
      where: { organizationId: `test-org-${ORG_SLUG}`, userId: user.id },
    });
    expect(memberCount).toBe(1);
  });

  it('rejects join without an approved request row', async () => {
    const { completeJoinWithApprovedRequest } = await import('@/lib/services/join.service');
    const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    const user = await createJoinTestUser(prisma, 100);

    const result = await completeJoinWithApprovedRequest(org!.id, user.id, user.email);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('JOIN_REQUEST_NOT_APPROVED');
    }
  });
});

if (!dbReady) {
  console.warn(
    '[integration] Test database not available — skipped join integration tests. Run: pnpm test:db:up && pnpm test:db:migrate'
  );
}

describe.skipIf(!dbReady)('invitation join (integration)', () => {
  const prisma = getTestPrisma();
  const ORG_SLUG = 'test-join-invite-org';

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    await resetJoinTestData(prisma);
    await seedJoinTestOrganization(prisma, ORG_SLUG);
  });

  afterAll(async () => {
    await resetJoinTestData(prisma);
    await prisma.$disconnect();
  });

  it('completes join for a valid pending invitation token', async () => {
    const {
      completeInvitationJoin,
      getInvitationByToken,
      maskInvitationEmail,
    } = await import('@/lib/services/join.service');
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'agent501@join-test.local',
      id: '11111111-1111-4111-8111-111111111111',
    });
    const user = await createJoinTestUser(prisma, 501);

    const summary = await getInvitationByToken(invitation.id);
    expect(summary.success).toBe(true);
    if (summary.success) {
      expect(summary.data.maskedEmail).toBe(maskInvitationEmail('agent501@join-test.local'));
    }

    const result = await completeInvitationJoin(invitation.id, user.id, user.email);
    expect(result.success).toBe(true);

    const member = await prisma.member.findFirst({
      where: { organizationId: org.id, userId: user.id },
    });
    expect(member).not.toBeNull();

    const redeemed = await prisma.invitation.findUnique({ where: { id: invitation.id } });
    expect(redeemed?.status).toBe('accepted');
  });

  it('rejects expired invitation tokens', async () => {
    const { getInvitationByToken, completeInvitationJoin } = await import(
      '@/lib/services/join.service'
    );
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      expiresAt: new Date(Date.now() - 60_000),
      email: 'agent502@join-test.local',
      id: '22222222-2222-4222-8222-222222222222',
    });
    const user = await createJoinTestUser(prisma, 502);

    const summary = await getInvitationByToken(invitation.id);
    expect(summary.success).toBe(false);
    if (!summary.success) {
      expect(summary.error.code).toBe('INVITATION_EXPIRED');
    }

    const result = await completeInvitationJoin(invitation.id, user.id, invitation.email);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVITATION_EXPIRED');
    }

    const memberCount = await prisma.member.count({
      where: { organizationId: org.id, userId: user.id },
    });
    expect(memberCount).toBe(0);
  });

  it('rejects revoked invitations and email mismatches', async () => {
    const { validateInvitationForJoin, completeInvitationJoin } = await import(
      '@/lib/services/join.service'
    );
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      status: 'revoked',
      id: '33333333-3333-4333-8333-333333333333',
    });
    const user = await createJoinTestUser(prisma, 503);

    const revoked = await validateInvitationForJoin(invitation.id, invitation.email);
    expect(revoked.success).toBe(false);
    if (!revoked.success) {
      expect(revoked.error.code).toBe('INVITATION_NOT_PENDING');
    }

    const pending = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'target@join-test.local',
      id: '44444444-4444-4444-8444-444444444444',
    });

    const mismatch = await validateInvitationForJoin(pending.id, 'other@join-test.local');
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(mismatch.error.code).toBe('INVITATION_EMAIL_MISMATCH');
    }

    const joinAttempt = await completeInvitationJoin(pending.id, user.id, user.email);
    expect(joinAttempt.success).toBe(false);
    if (!joinAttempt.success) {
      expect(joinAttempt.error.code).toBe('INVITATION_EMAIL_MISMATCH');
    }
  });

  it('rejects invitation when email domain is outside org allowlist', async () => {
    const { validateInvitationForJoin, completeInvitationJoin } = await import(
      '@/lib/services/join.service'
    );
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        metadata: serializeOrganizationMetadata({ allowedDomains: ['corp-only.example'] }),
      },
    });
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'agent505@join-test.local',
      id: '55555555-5555-4555-8555-555555555555',
    });
    const user = await createJoinTestUser(prisma, 505);

    const validation = await validateInvitationForJoin(invitation.id, invitation.email);
    expect(validation.success).toBe(false);
    if (!validation.success) {
      expect(validation.error.code).toBe('DOMAIN_NOT_ALLOWED');
    }

    const joinAttempt = await completeInvitationJoin(invitation.id, user.id, invitation.email);
    expect(joinAttempt.success).toBe(false);
    if (!joinAttempt.success) {
      expect(joinAttempt.error.code).toBe('DOMAIN_NOT_ALLOWED');
    }

    const memberCount = await prisma.member.count({
      where: { organizationId: org.id, userId: user.id },
    });
    expect(memberCount).toBe(0);
  });

  it('allows invitation redemption when org allowlist is empty', async () => {
    const { validateInvitationForJoin, completeInvitationJoin } = await import(
      '@/lib/services/join.service'
    );
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        metadata: serializeOrganizationMetadata({ allowedDomains: [] }),
      },
    });
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'agent506@join-test.local',
      id: '66666666-6666-4666-8666-666666666666',
    });
    const user = await createJoinTestUser(prisma, 506);

    const validation = await validateInvitationForJoin(invitation.id, invitation.email);
    expect(validation.success).toBe(true);

    const result = await completeInvitationJoin(invitation.id, user.id, invitation.email);
    expect(result.success).toBe(true);
  });

  it('redeemInvitation rejects a mismatched organizationId (tenant scope)', async () => {
    const { redeemInvitation } = await import('@/lib/services/join.service');
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const otherOrg = await prisma.organization.create({
      data: {
        id: 'test-join-other-org',
        name: 'Other Org',
        slug: 'test-join-other-org',
      },
    });
    const inviter = await createJoinTestInviter(prisma);
    const invitation = await seedJoinTestInvitation(prisma, {
      organizationId: org.id,
      inviterId: inviter.id,
      email: 'scoped@join-test.local',
      id: '77777777-7777-4777-8777-777777777777',
    });

    const result = await redeemInvitation(invitation.id, otherOrg.id);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVITATION_NOT_FOUND');
    }

    const unchanged = await prisma.invitation.findUnique({ where: { id: invitation.id } });
    expect(unchanged?.status).toBe('pending');
  });
});

describe.skipIf(!dbReady)('join request queue (integration)', () => {
  const prisma = getTestPrisma();
  const ORG_SLUG = 'test-join-queue-org';

  beforeAll(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    await resetJoinTestData(prisma);
    await seedJoinTestOrganization(prisma, ORG_SLUG);
  });

  afterAll(async () => {
    await resetJoinTestData(prisma);
    await prisma.$disconnect();
  });

  async function enableRequireApproval(orgId: string) {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        metadata: serializeOrganizationMetadata({
          allowedDomains: ['join-test.local'],
          requireApproval: true,
        }),
      },
    });
  }

  it('queues a pending join request when requireApproval is enabled', async () => {
    const { submitJoinRequest } = await import('@/lib/services/join-request.service');
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    await enableRequireApproval(org.id);

    const result = await submitJoinRequest(ORG_SLUG, 'agent601@join-test.local');
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe('pending');
    expect(result.data.joinRequestId).toBeTruthy();

    const memberCount = await prisma.member.count({
      where: { organizationId: org.id },
    });
    expect(memberCount).toBe(0);

    const pending = await prisma.joinRequest.findFirst({
      where: { organizationId: org.id, email: 'agent601@join-test.local' },
    });
    expect(pending?.status).toBe('PENDING');
  });

  it('rejects duplicate pending join requests for the same email', async () => {
    const { submitJoinRequest } = await import('@/lib/services/join-request.service');
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    await enableRequireApproval(org.id);

    const first = await submitJoinRequest(ORG_SLUG, 'agent602@join-test.local');
    const second = await submitJoinRequest(ORG_SLUG, 'agent602@join-test.local');

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.error.code).toBe('JOIN_REQUEST_ALREADY_PENDING');
    }
  });

  it('approves a pending request and creates a member when the user exists', async () => {
    const { submitJoinRequest, approveJoinRequest } = await import(
      '@/lib/services/join-request.service'
    );
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    await enableRequireApproval(org.id);
    const user = await createJoinTestUser(prisma, 603);
    const admin = await createJoinTestInviter(prisma);

    const submit = await submitJoinRequest(ORG_SLUG, user.email, user.id);
    expect(submit.success).toBe(true);
    if (!submit.success || !submit.data.joinRequestId) return;

    const approved = await approveJoinRequest(
      submit.data.joinRequestId,
      org.id,
      admin.id
    );
    expect(approved.success).toBe(true);
    if (!approved.success) return;

    expect(approved.data.memberId).toBeTruthy();

    const member = await prisma.member.findFirst({
      where: { organizationId: org.id, userId: user.id },
    });
    expect(member).not.toBeNull();

    const request = await prisma.joinRequest.findUnique({
      where: { id: submit.data.joinRequestId },
    });
    expect(request?.status).toBe('APPROVED');
    expect(request?.reviewedBy).toBe(admin.id);
  });

  it('auto-joins authenticated users when requireApproval is disabled via approved join request', async () => {
    const { submitJoinRequest } = await import('@/lib/services/join-request.service');
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const user = await createJoinTestUser(prisma, 604);

    const result = await submitJoinRequest(ORG_SLUG, user.email, user.id);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe('joined');

    const member = await prisma.member.findFirst({
      where: { organizationId: org.id, userId: user.id },
    });
    expect(member).not.toBeNull();

    const approvedRequest = await prisma.joinRequest.findFirst({
      where: { organizationId: org.id, email: user.email, status: 'APPROVED' },
    });
    expect(approvedRequest).not.toBeNull();
  });

  it('scopes approve to the organization tenant', async () => {
    const { submitJoinRequest, approveJoinRequest } = await import(
      '@/lib/services/join-request.service'
    );
    const org = await seedJoinTestOrganization(prisma, ORG_SLUG);
    const otherOrg = await seedJoinTestOrganization(prisma, 'test-join-other-org');
    await enableRequireApproval(org.id);
    const admin = await createJoinTestInviter(prisma);

    const submit = await submitJoinRequest(ORG_SLUG, 'agent605@join-test.local');
    expect(submit.success).toBe(true);
    if (!submit.success || !submit.data.joinRequestId) return;

    const crossTenant = await approveJoinRequest(
      submit.data.joinRequestId,
      otherOrg.id,
      admin.id
    );
    expect(crossTenant.success).toBe(false);
    if (!crossTenant.success) {
      expect(crossTenant.error.code).toBe('JOIN_REQUEST_NOT_FOUND');
    }
  });
});
