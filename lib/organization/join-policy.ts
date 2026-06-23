import type { JoinPolicy } from '@prisma/client';

/** Maps persisted join policy to the legacy requireApproval boolean used by APIs and UI. */
export function joinPolicyToRequireApproval(joinPolicy: JoinPolicy): boolean {
  return joinPolicy === 'DOMAIN_APPROVAL';
}

/**
 * Maps requireApproval (metadata / API) to the JoinPolicy column.
 * Undefined requireApproval → INVITE_ONLY (invitation-only, no self-serve domain join).
 */
export function requireApprovalToJoinPolicy(requireApproval: boolean | undefined): JoinPolicy {
  if (requireApproval === true) return 'DOMAIN_APPROVAL';
  if (requireApproval === false) return 'DOMAIN_AUTO';
  return 'INVITE_ONLY';
}
