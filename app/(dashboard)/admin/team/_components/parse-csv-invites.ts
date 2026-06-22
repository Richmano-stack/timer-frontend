import { OrganizationRole } from '@/lib/organization/roles';

export interface CsvInviteRow {
  email: string;
  role: OrganizationRole;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRole(value: string | undefined): OrganizationRole | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'member' || normalized === 'agent') return 'member';
  if (normalized === 'admin') return 'admin';
  return null;
}

function isHeaderLine(parts: string[]): boolean {
  const first = parts[0]?.trim().toLowerCase();
  return first === 'email' || first === 'e-mail';
}

export function parseCsvInvites(text: string): { rows: CsvInviteRow[]; errors: string[] } {
  const rows: CsvInviteRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const parts = line.split(/[,;\t]/).map((part) => part.trim().replace(/^"|"$/g, ''));

    if (index === 0 && isHeaderLine(parts)) {
      return;
    }

    const email = parts[0]?.trim().toLowerCase();
    if (!email) {
      errors.push(`Line ${lineNo}: missing email.`);
      return;
    }

    if (!EMAIL_RE.test(email)) {
      errors.push(`Line ${lineNo}: invalid email "${parts[0]}".`);
      return;
    }

    const role = parseRole(parts[1]);
    if (parts[1] !== undefined && parts[1] !== '' && role === null) {
      errors.push(`Line ${lineNo}: role must be member or admin.`);
      return;
    }

    if (seen.has(email)) {
      errors.push(`Line ${lineNo}: duplicate email "${email}".`);
      return;
    }

    seen.add(email);
    rows.push({ email, role: role ?? 'member' });
  });

  return { rows, errors };
}
