import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { StatusHistoryItem } from '@/types';
import { StatusHistoryTable } from '@/components/StatusHistoryTable';
import { History } from 'lucide-react';

export default async function StatusHistoryPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let history: StatusHistoryItem[] = [];
    try {
        history = await api.get<StatusHistoryItem[]>('/api/status/history', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        console.error('Failed to fetch history', error);
    }

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

            <StatusHistoryTable history={history} />
        </div>
    );
}
