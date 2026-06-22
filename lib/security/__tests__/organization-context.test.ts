import { describe, expect, it } from 'vitest';
import {
  assertOrganizationId,
  withOrganizationScope,
} from '@/lib/security/organization-context';

describe('withOrganizationScope', () => {
  it('merges organizationId into an existing where clause', () => {
    expect(
      withOrganizationScope('org-1', { userId: 'user-1', endTime: null })
    ).toEqual({
      userId: 'user-1',
      endTime: null,
      organizationId: 'org-1',
    });
  });

  it('preserves additional filter keys', () => {
    expect(withOrganizationScope('org-2', { id: 'segment-1' })).toEqual({
      id: 'segment-1',
      organizationId: 'org-2',
    });
  });
});

describe('assertOrganizationId', () => {
  it('does not throw for a non-empty organization id', () => {
    expect(() => assertOrganizationId('org-1', 'test')).not.toThrow();
  });

  it('throws when organization id is missing', () => {
    expect(() => assertOrganizationId(undefined, 'getAdminOverviewService')).toThrow(
      'Tenant scope violation: missing organizationId for getAdminOverviewService'
    );
  });
});
