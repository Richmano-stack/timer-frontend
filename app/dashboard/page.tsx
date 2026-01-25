import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { Status, StatusHistoryItem } from '@/types';
import { CurrentStatusCard } from '@/components/CurrentStatusCard';
import { StatusSwitcher } from '@/components/StatusSwitcher';
import { SummaryCards } from '@/components/SummaryCards';
import { LayoutDashboard } from 'lucide-react';

interface DashboardProps {
    searchParams: Promise<{ view?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
    const cookieHeader = (await cookies()).toString();
    const { view = 'today' } = await searchParams;

    // Concurrent Data Fetching
    const [statusRes, summaryRes] = await Promise.allSettled([
        api.get<Status>('/api/status/current', { headers: { Cookie: cookieHeader } }),
        fetchSummary(view, cookieHeader)
    ]);

    const currentStatus = statusRes.status === 'fulfilled' ? statusRes.value : null;
    const summary = summaryRes.status === 'fulfilled' ? summaryRes.value : [];

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gray-900 rounded-lg shadow-lg">
                        <LayoutDashboard className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}</h1>
                        <p className="text-sm text-gray-500">Here's your activity overview.</p>
                    </div>
                </div>
            </header>

            <main className="space-y-8">
                <section className="w-full">
                    <CurrentStatusCard status={currentStatus} />
                </section>

                <section className="bg-[#D9D9D9] rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Status</h3>
                    <StatusSwitcher currentStatus={currentStatus?.status_name || 'off_duty'} />
                </section>

                <section>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 px-1">
                        {view === 'today' ? "Today's Summary" : "Weekly Summary"}
                    </h3>
                    <SummaryCards summary={summary} />
                </section>
            </main>
        </div>
    );
}

/**
 * Data Orchestration Helper
 */
async function fetchSummary(view: string, cookieHeader: string) {
    if (view === 'today') {
        const res = await api.get<{ summary: any[] }>('/api/status/summary', {
            headers: { Cookie: cookieHeader }
        });
        return res.summary;
    }

    // Weekly Calculation Logic
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    const params = new URLSearchParams({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        limit: '1000'
    });

    const res = await api.get<{ data: StatusHistoryItem[] }>(`/api/status/history?${params}`, {
        headers: { Cookie: cookieHeader }
    });

    const history = Array.isArray(res) ? res : res.data;
    const durationByStatus: Record<string, number> = {};

    history.forEach((item) => {
        const duration = Number(item.duration_ms) || 0;
        durationByStatus[item.status_name] = (durationByStatus[item.status_name] || 0) + duration;
    });

    return Object.entries(durationByStatus).map(([status_name, total_duration]) => ({
        status_name,
        total_duration: total_duration.toString()
    }));
}