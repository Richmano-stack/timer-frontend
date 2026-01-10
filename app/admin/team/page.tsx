import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { TeamStatus } from '@/types';
import { TeamStatusTable } from '@/components/TeamStatusTable';

export default async function TeamStatusPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let teamStatus: TeamStatus[] = [];
    try {
        teamStatus = await api.get<TeamStatus[]>('/api/admin/team-status', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        console.error('Failed to fetch team status', error);
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-gray-900">Team Status</h1>
            <TeamStatusTable teamStatus={teamStatus} />
        </div>
    );
}
