import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { StatusHistoryItem } from '@/types';
import { StatusHistoryTable } from '@/components/StatusHistoryTable';
import { History } from 'lucide-react';

export default async function StatusHistoryPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const resolvedSearchParams = await searchParams;
    const page = Number(resolvedSearchParams.page) || 1;
    const startDate = resolvedSearchParams.startDate as string || '';
    const endDate = resolvedSearchParams.endDate as string || '';
    const limit = 10;

    let history: StatusHistoryItem[] = [];
    let pagination: { currentPage: number; totalPages: number; totalItems: number; hasNextPage: boolean; hasPrevPage: boolean } | null = null;
    let error: string | null = null;

    try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', page.toString());
        queryParams.set('limit', limit.toString());
        if (startDate) queryParams.set('startDate', startDate);
        if (endDate) queryParams.set('endDate', endDate);

        const response = await api.get<{
            data: StatusHistoryItem[],
            pagination?: {
                currentPage: number;
                totalPages: number;
                totalItems: number;
                hasNextPage: boolean;
                hasPrevPage: boolean;
            }
        }>(`/api/status/history?${queryParams.toString()}`, {
            headers: { Cookie: cookieHeader }
        });

        if (Array.isArray(response)) {
            history = response;
            pagination = {
                currentPage: 1,
                totalPages: 1,
                totalItems: response.length,
                hasNextPage: false,
                hasPrevPage: false
            };
        } else if (response && response.data) {
            history = response.data;
            pagination = response.pagination || {
                currentPage: 1,
                totalPages: 1,
                totalItems: response.data.length,
                hasNextPage: false,
                hasPrevPage: false
            };
        }
    } catch (err) {
        console.error('Failed to fetch history', err);
        error = 'Failed to load history. Please try again later.';
    }

    const totalPages = pagination?.totalPages || 1;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex items-center space-x-3">
                <div className="p-2 bg-black rounded-lg shadow-sm">
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
                totalPages={totalPages}
                initialStartDate={startDate}
                initialEndDate={endDate}
                pagination={pagination}
                error={error}
            />
        </div>
    );
}
