import type { Metadata } from 'next';
import { TeamInviteDashboard } from '@/components/admin/TeamInviteDashboard';

export const metadata: Metadata = {
  title: 'Team',
};

export default function AdminTeamPage() {
  return <TeamInviteDashboard />;
}
