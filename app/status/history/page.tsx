import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { StatusHistoryItem } from '@/types';
import { StatusHistoryTable } from '@/components/StatusHistoryTable';

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
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-gray-900">Status History</h1>
            <StatusHistoryTable history={history} />
        </div>
    );
}
