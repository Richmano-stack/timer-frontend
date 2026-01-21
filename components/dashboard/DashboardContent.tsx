'use client';

import React, { useEffect, useState } from 'react';
import { StatusHero } from './StatusHero';
import { StatusControlGrid } from './StatusControlGrid';
import { QuickStats } from '@/components/dashboard/QuickStats';
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
        let eventSource: EventSource | null = null;
        let retryCount = 0;
        let reconnectionTimeout: NodeJS.Timeout | null = null;

        const connectSSE = () => {
            console.log(`[SSE] Attempting connection... (Attempt ${retryCount + 1})`);
            eventSource = new EventSource('/api/sse/status');

            eventSource.onopen = () => {
                console.log('[SSE] Connection established successfully');
                retryCount = 0; // Reset retry count on successful connection
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'status_update') {
                        console.log('[SSE] Received status update:', data.status);
                        setStatus(data.status);
                    }
                } catch (error) {
                    console.error('[SSE] Error parsing message data:', error);
                }
            };

            eventSource.onerror = (error) => {
                const state = eventSource?.readyState;
                console.error(`[SSE] Connection error. ReadyState: ${state}`, error);

                if (eventSource) {
                    eventSource.close();
                    eventSource = null;
                }

                // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                console.log(`[SSE] Reconnecting in ${delay}ms...`);

                reconnectionTimeout = setTimeout(() => {
                    retryCount++;
                    connectSSE();
                }, delay);
            };
        };

        connectSSE();

        return () => {
            console.log('[SSE] Cleaning up connection');
            if (eventSource) {
                eventSource.close();
            }
            if (reconnectionTimeout) {
                clearTimeout(reconnectionTimeout);
            }
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
