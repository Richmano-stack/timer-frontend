import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { TeamStatus } from '@/types';
import { TeamStatusTable } from '@/components/TeamStatusTable';

import { redirect } from 'next/navigation';
import { User } from '@/types';

export default async function TeamStatusPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let currentUser: User | null = null;
    try {
        currentUser = await api.get<User>('/api/auth/me', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        redirect('/login');
    }

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'supervisor')) {
        redirect('/dashboard');
    }

    let teamStatus: TeamStatus[] = [];
    try {
        teamStatus = await api.get<TeamStatus[]>('/api/admin/team-status', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        console.error('Failed to fetch team status', error);
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Team Status</h1>
                <p className="text-sm text-gray-500">Monitor real-time status of all team members.</p>
            </div>
            <TeamStatusTable initialTeamStatus={teamStatus} />
        </div>
    );
}
