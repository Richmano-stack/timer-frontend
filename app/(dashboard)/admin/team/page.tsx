import type { Metadata } from 'next';
import { TeamInviteDashboard } from './_components/TeamInviteDashboard';

export const metadata: Metadata = {
  title: 'Team',
};

export default function AdminTeamPage() {
  return <TeamInviteDashboard />;
}
