import React from 'react';
import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { Status, SummaryItem } from '@/types';

export const metadata = {
    title: 'Dashboard | Nexuma',
    description: 'Real-time status tracking and performance metrics.',
};

async function getInitialData() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const headers = { Cookie: cookieHeader };

    try {
        const [status, summary] = await Promise.all([
            api.get<Status>('/api/status/current', { headers }).catch(() => null),
            api.get<SummaryItem[]>('/api/stats/summary', { headers }).catch(() => []),
        ]);

        return { status, summary };
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        return { status: null, summary: [] };
    }
}

export default async function DashboardPage() {
    const { status, summary } = await getInitialData();

    return (
        <DashboardContent
            initialStatus={status}
            initialSummary={summary || []}
        />
    );
}
