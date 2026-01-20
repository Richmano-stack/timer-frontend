'use client';

import React, { useEffect, useState } from 'react';
import { StatusHero } from './StatusHero';
import { StatusControlGrid } from './StatusControlGrid';
import { QuickStats } from './QuickStats';
import { Status, SummaryItem } from '@/types';
import { useRouter } from 'next/navigation';

interface DashboardContentProps {
    initialStatus: Status | null;
    initialSummary: SummaryItem[];
}

export const DashboardContent: React.FC<DashboardContentProps> = ({ initialStatus, initialSummary }) => {
    const router = useRouter();
    const [status, setStatus] = useState<Status | null>(initialStatus);
    const [summary, setSummary] = useState<SummaryItem[]>(initialSummary);

    // Sync state with props when they change (e.g. after router.refresh())
    useEffect(() => {
        setStatus(initialStatus);
        setSummary(initialSummary);
    }, [initialStatus, initialSummary]);

    // SSE Connection for real-time updates
    useEffect(() => {
        const eventSource = new EventSource('/api/sse/status');

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'status_update') {
                    setStatus(data.status);
                    // Optionally refresh summary if backend sends it or trigger a refresh
                    // router.refresh(); // Might be too heavy for frequent updates
                }
            } catch (error) {
                console.error('Error parsing SSE data:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('SSE Error:', error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    return (
        <div className="min-h-screen bg-[#F9F9F9] p-6 font-sans text-gray-900">
            <div className="mx-auto max-w-7xl space-y-8">
                {/* Header / Meta */}
                <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
                    <p className="text-gray-500">Manage your presence and track performance.</p>
                </header>

                {/* Hero Section */}
                <section>
                    <StatusHero status={status} />
                </section>

                {/* Controls Section */}
                <section>
                    <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900">Quick Actions</h2>
                    <StatusControlGrid currentStatus={status?.status_name || 'off_duty'} />
                </section>

                {/* Stats Section */}
                <section>
                    <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900">Performance Overview</h2>
                    <QuickStats summary={summary} />
                </section>
            </div>
        </div>
    );
};
