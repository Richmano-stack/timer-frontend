import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { StatusHistoryItem } from '@/types';
import { AnalyticsDashboard } from '@/components/AnalyticsDashboard';
import { BarChart3 } from 'lucide-react';

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const resolvedSearchParams = await searchParams;

    const startDate = resolvedSearchParams.startDate as string || '';
    const endDate = resolvedSearchParams.endDate as string || '';

    let history: StatusHistoryItem[] = [];

    try {
        const queryParams = new URLSearchParams();
        // For analytics, we might want more data than just 10 items.
        // Let's fetch a larger set or a specific analytics endpoint if it exists.
        // Based on previous audit, we use /api/status/history with filters.
        queryParams.set('limit', '1000');
        if (startDate) queryParams.set('startDate', startDate);
        if (endDate) queryParams.set('endDate', endDate);

        const response = await api.get<{ data: StatusHistoryItem[], meta: { total: number } }>(`/api/status/history?${queryParams.toString()}`, {
            headers: { Cookie: cookieHeader }
        });

        if (Array.isArray(response)) {
            history = response;
        } else {
            history = response.data;
        }
    } catch (error) {
        console.error('Failed to fetch history for analytics', error);
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                    <BarChart3 className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Analytics & Reporting</h1>
                    <p className="text-sm text-gray-500">Analyze your time distribution and productivity trends.</p>
                </div>
            </div>

            <AnalyticsDashboard
                history={history}
                initialStartDate={startDate}
                initialEndDate={endDate}
            />
        </div>
    );
}
