import { cookies } from 'next/headers';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Status, StatusHistoryItem } from '@/types';
import { CurrentStatusCard } from '@/components/CurrentStatusCard';
import { StatusSwitcher } from '@/components/StatusSwitcher';
import { SummaryCards } from '@/components/SummaryCards';
import { LayoutDashboard } from 'lucide-react';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const resolvedSearchParams = await searchParams;
    const view = resolvedSearchParams.view as string || 'today';

    let currentStatus: Status | null = null;
    try {
        currentStatus = await api.get<Status>('/api/status/current', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        // If 404 or other error, assume offline or no active status
    }

    let summary: any[] = [];
    try {
        if (view === 'today') {
            const summaryData = await api.get<{ summary: any[] }>('/api/status/summary', {
                headers: { Cookie: cookieHeader }
            });
            summary = summaryData.summary;
        } else {
            // Fetch last 7 days history and calculate summary
            const end = new Date();
            const start = new Date();
            start.setDate(end.getDate() - 7);
            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const historyResponse = await api.get<{ data: StatusHistoryItem[] }>(`/api/status/history?startDate=${startStr}&endDate=${endStr}&limit=1000`, {
                headers: { Cookie: cookieHeader }
            });

            const history = Array.isArray(historyResponse) ? historyResponse : historyResponse.data;

            const durationByStatus: Record<string, number> = {};
            history.forEach((item: any) => {
                const duration = item.duration_ms ? Number(item.duration_ms) : 0;
                durationByStatus[item.status_name] = (durationByStatus[item.status_name] || 0) + duration;
            });

            summary = Object.entries(durationByStatus).map(([status_name, total_duration]) => ({
                status_name,
                total_duration: total_duration.toString()
            }));
        }
    } catch (error) {
        console.error('Failed to fetch summary', error);
    }

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                        <LayoutDashboard className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}</h1>
                        <p className="text-sm text-gray-500">Here's your activity overview.</p>
                    </div>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <Link
                        href="/dashboard?view=today"
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'today' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Today
                    </Link>
                    <Link
                        href="/dashboard?view=week"
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Last 7 Days
                    </Link>
                </div>
            </div>

            <div className="space-y-8">
                {/* Top Section: Status & Switcher */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Current Status */}
                    <div className="lg:col-span-1">
                        <CurrentStatusCard status={currentStatus} />
                    </div>

                    {/* Right: Status Switcher */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Status</h3>
                            <StatusSwitcher currentStatus={currentStatus?.status_name || 'off_duty'} />
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Summary Stats */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 px-1">
                        {view === 'today' ? "Today's Summary" : "Weekly Summary"}
                    </h3>
                    <SummaryCards summary={summary} />
                </div>
            </div>
        </div>
    );
}
