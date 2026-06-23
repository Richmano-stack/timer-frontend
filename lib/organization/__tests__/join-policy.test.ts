import { describe, expect, it } from 'vitest';
import {
  joinPolicyToRequireApproval,
  requireApprovalToJoinPolicy,
} from '@/lib/organization/join-policy';

describe('joinPolicyToRequireApproval', () => {
  it('returns true only for DOMAIN_APPROVAL', () => {
    expect(joinPolicyToRequireApproval('DOMAIN_APPROVAL')).toBe(true);
    expect(joinPolicyToRequireApproval('DOMAIN_AUTO')).toBe(false);
    expect(joinPolicyToRequireApproval('INVITE_ONLY')).toBe(false);
  });
});

describe('requireApprovalToJoinPolicy', () => {
  it('maps boolean requireApproval to join policy enum values', () => {
    expect(requireApprovalToJoinPolicy(true)).toBe('DOMAIN_APPROVAL');
    expect(requireApprovalToJoinPolicy(false)).toBe('DOMAIN_AUTO');
    expect(requireApprovalToJoinPolicy(undefined)).toBe('INVITE_ONLY');
  });
});
