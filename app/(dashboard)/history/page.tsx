import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { StatusHistoryItem } from '@/types';
import { StatusHistoryTable } from '@/components/StatusHistoryTable';
import { History } from 'lucide-react';

import { redirect } from 'next/navigation';

export default async function StatusHistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const resolvedSearchParams = await searchParams;

    try {
        await api.get('/api/auth/me', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        redirect('/login');
    }

    const page = Number(resolvedSearchParams.page) || 1;
    const startDate = resolvedSearchParams.startDate as string || '';
    const endDate = resolvedSearchParams.endDate as string || '';
    const limit = 10;

    let history: StatusHistoryItem[] = [];
    let total = 0;

    try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', page.toString());
        queryParams.set('limit', limit.toString());
        if (startDate) queryParams.set('startDate', startDate);
        if (endDate) queryParams.set('endDate', endDate);

        const response = await api.get<{ data: StatusHistoryItem[], meta: { total: number } }>(`/api/status/history?${queryParams.toString()}`, {
            headers: { Cookie: cookieHeader }
        });

        // Handle both array response (legacy) and paginated response
        if (Array.isArray(response)) {
            history = response;
            total = response.length;
        } else {
            history = response.data;
            total = response.meta.total;
        }
    } catch (error) {
        console.error('Failed to fetch history', error);
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                    <History className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Status History</h1>
                    <p className="text-sm text-gray-500">View your past status changes and durations.</p>
                </div>
            </div>

            <StatusHistoryTable
                history={history}
                currentPage={page}
                totalPages={totalPages || 1}
                initialStartDate={startDate}
                initialEndDate={endDate}
            />
        </div>
    );
}
