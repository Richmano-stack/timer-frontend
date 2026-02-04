'use client';

import React, { useEffect, useState } from 'react';
import { StatusControlGrid } from '@/components/status/StatusControlGrid';
import { StatusHero } from '@/components/dashboard/StatusHero';
import { api } from '@/lib/api';
import { Status } from '@/types';

export default function DashboardContent() {
    const [status, setStatus] = useState<Status | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    // Initial Sync with Server (The Source of Truth)
    useEffect(() => {
        const fetchCurrentStatus = async () => {
            try {
                const response = await api.get<Status>('/api/status/current');
                setStatus(response);
            } catch (err: any) {
                if (err?.statusCode === 404) {
                    // 404 is expected when user is off duty / no current status
                    setStatus(null);
                } else {
                    console.error("Failed to sync status on mount", err);
                }
                // Fallback or Error Boundary trigger
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchCurrentStatus();
    }, []);

    if (isInitialLoading) {
        return <div className="p-8 text-center animate-pulse">Syncing with server...</div>;
    }

    return (
        <div className="space-y-12">
            <header>
                <h1 className="text-2xl font-bold mb-2">Status Dashboard</h1>
                <p className="text-gray-500">Status manager</p>
            </header>

            {/* Hero Section */}
            <section>
                <StatusHero status={status} />
            </section>

            <StatusControlGrid
                currentStatus={status?.statusName || 'off_duty'}
                onStatusChange={(newStatus) => {
                    // Optimistic update
                    setStatus(prev => {
                        if (prev) {
                            return { ...prev, statusName: newStatus, startTime: Date.now() };
                        }
                        return {
                            id: 0, // Placeholder
                            userId: 'current',
                            statusName: newStatus,
                            startTime: Date.now(),
                            durationMs: 0
                        };
                    });
                }}
            />
        </div>
    );
}