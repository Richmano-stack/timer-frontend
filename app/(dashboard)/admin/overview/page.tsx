import type { Metadata } from 'next';
import { AdminOverviewDashboard } from '@/components/admin/AdminOverviewDashboard';

export const metadata: Metadata = {
  title: 'Floor Monitor',
};

export default function AdminOverviewPage() {
  return <AdminOverviewDashboard />;
}
