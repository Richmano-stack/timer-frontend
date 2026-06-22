import { describe, expect, it } from 'vitest';
import { resolvePostSignInPath } from '@/lib/auth/resolve-post-sign-in-path';

describe('resolvePostSignInPath', () => {
  it('prefers the next query param when present', () => {
    expect(resolvePostSignInPath('/admin/team', 'member')).toBe('/admin/team');
  });

  it('routes owners and admins to the admin overview', () => {
    expect(resolvePostSignInPath(null, 'owner')).toBe('/admin/overview');
    expect(resolvePostSignInPath(null, 'admin')).toBe('/admin/overview');
  });

  it('routes members to the employee track page', () => {
    expect(resolvePostSignInPath(null, 'member')).toBe('/employee/track');
    expect(resolvePostSignInPath(undefined, undefined)).toBe('/employee/track');
  });
});
