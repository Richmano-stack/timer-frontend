import DashboardContent from '@/components/status/DashboardContent';

export default function DashboardPage() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <DashboardContent />
        </div>
    );
}

// ==========================================
// PRESERVED COMMENTED OUT CODE BELOW
// ==========================================

/* import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { Status, StatusHistoryItem, StatusType } from '@/types';
import DashboardContent from '@/components/status/DashboardContent';

export const dynamic = 'force-dynamic';

interface DashboardProps {
    searchParams: Promise<{ view?: string }>;
}



async function fetchSummary(view: string, cookieHeader: string) {
    const headers = { Cookie: cookieHeader };
    
    if (view === 'today') {
        // Assuming your wrapper returns the data directly
        const res = await api.get<{ summary: any[] }>('/api/status/summary', { headers });
        return res.summary || [];
    }

    // Logic for History Range
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    const params = new URLSearchParams({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    });

    const data = await api.get<StatusHistoryItem[]>(`/api/status/history?${params}`, { headers });
    
    // Safety check: Backend might return { data: [] } or just []
    const history = Array.isArray(data) ? data : (data as any).data || [];

    const durationByStatus: Record<string, number> = {};
    history.forEach((item: StatusHistoryItem) => {
        // Use the property names from your interface (statusName vs status_name)
        const name = item.statusName || (item as any).status_name;
        const duration = Number(item.durationMs) || Number((item as any).duration_ms) || 0;
        durationByStatus[name] = (durationByStatus[name] || 0) + duration;
    });

    return Object.entries(durationByStatus).map(([name, total]) => ({
        status_name: name as StatusType,
        total_duration: total.toString()
    }));
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
    const cookieHeader = (await cookies()).toString();
    const { view = 'today' } = await searchParams;

    // SSR Fetching
    const [statusRes, summaryRes] = await Promise.allSettled([
        api.get<Status>(`/api/status/current`, { headers: { Cookie: cookieHeader } }),
        fetchSummary(view, cookieHeader)
    ]);

    // TYPE SAFE EXTRACTION
    const initialStatus = statusRes.status === 'fulfilled' ? statusRes.value : null;
    const initialSummary = summaryRes.status === 'fulfilled' ? summaryRes.value : [];

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <DashboardContent 
                initialStatus={initialStatus} 
                initialSummary={initialSummary} 
            />
        </div>
    );
} */