import type { Metadata } from 'next';
import { AdminReportsDashboard } from '@/components/admin/AdminReportsDashboard';

export const metadata: Metadata = {
  title: 'Reports',
};

export default function AdminReportsPage() {
  return <AdminReportsDashboard />;
}
