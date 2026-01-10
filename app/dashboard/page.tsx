import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { Status } from '@/types';
import { CurrentStatusCard } from '@/components/CurrentStatusCard';
import { StatusSwitcher } from '@/components/StatusSwitcher';
import { SummaryCards } from '@/components/SummaryCards';

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let currentStatus: Status | null = null;
    try {
        currentStatus = await api.get<Status>('/api/status/current', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        // If 404 or other error, assume offline or no active status
        // console.error('Failed to fetch status', error);
    }

    let summary = { totalDuration: 0, statusBreakdown: {} };
    try {
        summary = await api.get('/api/status/summary', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        // console.error('Failed to fetch summary', error);
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

            <SummaryCards summary={summary} />

            <CurrentStatusCard status={currentStatus} />

            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Change Status</h3>
                <StatusSwitcher currentStatus={currentStatus?.status || 'OFFLINE'} />
            </div>
        </div>
    );
}
