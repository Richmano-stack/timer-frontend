import { describe, expect, it } from 'vitest';
import {
  emailMatchesAllowedDomains,
  parseOrganizationMetadata,
  serializeOrganizationMetadata,
} from '@/lib/organization/metadata';

describe('emailMatchesAllowedDomains', () => {
  it('returns false for malformed email without @', () => {
    expect(emailMatchesAllowedDomains('not-an-email', ['acme.com'])).toBe(false);
  });

  it('returns false when allowedDomains is empty', () => {
    expect(emailMatchesAllowedDomains('user@acme.com', [])).toBe(false);
  });

  it('matches case-insensitively and strips leading @ from allowed domain entries', () => {
    expect(emailMatchesAllowedDomains('User@ACME.com', ['@acme.com'])).toBe(true);
  });

  it('rejects subdomain spoofing when only root domain is allowed', () => {
    expect(emailMatchesAllowedDomains('user@evil-acme.com', ['acme.com'])).toBe(false);
  });
});

describe('parseOrganizationMetadata', () => {
  it('returns null for invalid JSON', () => {
    expect(parseOrganizationMetadata('{not-json')).toBeNull();
  });

  it('filters non-string entries from allowedDomains array', () => {
    const parsed = parseOrganizationMetadata(
      JSON.stringify({ allowedDomains: ['acme.com', 42, null, 'beta.com'] })
    );

    expect(parsed).toEqual({ allowedDomains: ['acme.com', 'beta.com'] });
  });

  it('normalizes domains on parse', () => {
    const parsed = parseOrganizationMetadata(
      JSON.stringify({ allowedDomains: [' @ACME.com ', 'Beta.COM'] })
    );

    expect(parsed).toEqual({ allowedDomains: ['acme.com', 'beta.com'] });
  });

  it('parses timezone and requireApproval when present', () => {
    const parsed = parseOrganizationMetadata(
      JSON.stringify({
        allowedDomains: ['acme.com'],
        requireApproval: true,
        timezone: 'America/New_York',
      })
    );

    expect(parsed).toEqual({
      allowedDomains: ['acme.com'],
      requireApproval: true,
      timezone: 'America/New_York',
    });
  });

  it('parses compliance limit fields when present', () => {
    const parsed = parseOrganizationMetadata(
      JSON.stringify({
        allowedDomains: ['acme.com'],
        maxShiftHours: 10,
        maxBreakMinutes: 20,
        maxLunchMinutes: 60,
      })
    );

    expect(parsed).toEqual({
      allowedDomains: ['acme.com'],
      maxShiftHours: 10,
      maxBreakMinutes: 20,
      maxLunchMinutes: 60,
    });
  });
});

describe('serializeOrganizationMetadata', () => {
  it('persists normalized domains', () => {
    const raw = serializeOrganizationMetadata({ allowedDomains: [' @Acme.COM '] });
    expect(JSON.parse(raw)).toEqual({ allowedDomains: ['acme.com'] });
  });

  it('persists timezone when provided', () => {
    const raw = serializeOrganizationMetadata({
      allowedDomains: ['acme.com'],
      timezone: 'Europe/London',
    });
    expect(JSON.parse(raw)).toEqual({
      allowedDomains: ['acme.com'],
      timezone: 'Europe/London',
    });
  });

  it('persists compliance limits when provided', () => {
    const raw = serializeOrganizationMetadata({
      allowedDomains: ['acme.com'],
      maxShiftHours: 8,
      maxBreakMinutes: 15,
      maxLunchMinutes: 45,
    });
    expect(JSON.parse(raw)).toEqual({
      allowedDomains: ['acme.com'],
      maxShiftHours: 8,
      maxBreakMinutes: 15,
      maxLunchMinutes: 45,
    });
  });
});
