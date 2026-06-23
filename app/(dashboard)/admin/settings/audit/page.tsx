import type { Metadata } from 'next';
import { AuditLogTable } from './_components/AuditLogTable';

export const metadata: Metadata = {
  title: 'Audit trail',
};

export default function AdminAuditTrailPage() {
  return <AuditLogTable />;
}
