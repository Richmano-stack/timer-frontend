import type { Metadata } from 'next';
import { OrganizationSettingsDashboard } from './_components/OrganizationSettingsDashboard';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function AdminSettingsPage() {
  return <OrganizationSettingsDashboard />;
}
