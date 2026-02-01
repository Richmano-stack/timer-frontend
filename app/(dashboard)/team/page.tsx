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
        const response = await api.get<{ user: User; session: any }>('/api/auth/get-session', {
            headers: { Cookie: cookieHeader }
        });
        currentUser = response?.user || null;
    } catch (error) {
        console.error("Auth session fetch failed in Team Page", error);
    }
    console.log(currentUser);

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'supervisor')) {
        console.log("Access Denied for role:", currentUser?.role); // Debug check
        redirect('/dashboard');
    }

    let teamStatus: TeamStatus[] = [];
    let fetchError = false;
    try {
        teamStatus = await api.get<TeamStatus[]>('/api/admin/team-status', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        console.error('Data layer failure:', error);
        fetchError = true;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Team Status</h1>
                <p className="text-sm text-gray-500">Monitor real-time status of all team members.</p>
            </div>
            {fetchError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center">
                    <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                        <span className="text-red-600 text-xl">⚠️</span>
                    </div>
                    <h3 className="text-lg font-semibold text-red-900">System Unavailable</h3>
                    <p className="text-red-600 mt-1">We're having trouble reaching the team server. Please try again in a few minutes.</p>
                </div>
            ) : (
                <TeamStatusTable initialTeamStatus={teamStatus} />
            )}
        </div>
    );
}
