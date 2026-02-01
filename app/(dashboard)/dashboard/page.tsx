import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { Status, StatusHistoryItem, StatusType } from '@/types';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export const dynamic = 'force-dynamic';

interface DashboardProps {
    searchParams: Promise<{ view?: string }>;
}

async function fetchSummary(view: string, cookieHeader: string) {
    if (view === 'today') {
        const res = await api.get<{ summary: any[] }>('/api/status/summary', {
            headers: { Cookie: cookieHeader }
        });
        return res.summary;
    }

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
        status_name: status_name as StatusType,
        total_duration: total_duration.toString()
    }));
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
    const cookieHeader = (await cookies()).toString();
    const { view = 'today' } = await searchParams;

    // Fetch initial data for SSR
    const [statusRes, summaryRes] = await Promise.allSettled([
        api.get<Status>(`/api/status/current?t=${Date.now()}`, { headers: { Cookie: cookieHeader }, next: { revalidate: 0 } }),
        fetchSummary(view, cookieHeader)
    ]);

    const initialStatus = statusRes.status === 'fulfilled' ? statusRes.value : null;
    const initialSummary = summaryRes.status === 'fulfilled' ? summaryRes.value : [];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <DashboardContent
                key={initialStatus?.status_name || 'off_duty'}
                initialStatus={initialStatus}
                initialSummary={initialSummary}
            />
        </div>
    );
}
