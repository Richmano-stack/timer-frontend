import { describe, expect, it } from 'vitest';
import { isAdminRole, primaryRole } from '@/lib/organization/roles';

describe('primaryRole', () => {
  it('returns the first comma-separated role, normalized to lowercase', () => {
    expect(primaryRole('owner,member')).toBe('owner');
    expect(primaryRole('Admin, member')).toBe('admin');
    expect(primaryRole('MEMBER,admin')).toBe('member');
  });

  it('defaults unknown roles to member', () => {
    expect(primaryRole('superuser')).toBe('member');
    expect(primaryRole('')).toBe('member');
  });
});

describe('isAdminRole', () => {
  it('grants access to owners and admins', () => {
    expect(isAdminRole('owner')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('OWNER')).toBe(true);
    expect(isAdminRole('Admin')).toBe(true);
  });

  it('denies access to members and missing roles', () => {
    expect(isAdminRole('member')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  it('uses the primary role when multiple roles are present', () => {
    expect(isAdminRole('admin,member')).toBe(true);
    expect(isAdminRole('owner,member')).toBe(true);
    expect(isAdminRole('member,admin')).toBe(false);
  });
});
