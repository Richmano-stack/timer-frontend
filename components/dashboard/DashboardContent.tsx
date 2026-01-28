'use client';

import React, { useEffect, useState } from 'react';
import { StatusHero } from './StatusHero';
import { StatusControlGrid } from './StatusControlGrid';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { Status, SummaryItem, StatusType } from '@/types';
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

    const handleStatusChangeSuccess = (newStatusName: StatusType) => {
        // 1. Manually update local state immediately (Optimistic Update)
        setStatus(prev => prev ? { ...prev, status_name: newStatusName } : {
            id: 'temp',
            user_id: 'current',
            status_name: newStatusName,
            start_time: new Date().toISOString()
        } as Status);

        // 2. router.refresh() is already handled in StatusControlGrid, 
        // but we've updated the local state here to "lead" the state.
    };

    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <section>
                <StatusHero status={status} />
            </section>

            {/* Controls Section */}
            <section>
                <h2 className="eyebrow mb-6">Quick Actions</h2>
                <StatusControlGrid
                    currentStatus={status?.status_name || 'off_duty'}
                    onStatusChange={handleStatusChangeSuccess}
                />
            </section>

            {/* Stats Section */}
            <section>
                <h2 className="eyebrow mb-6">Performance Overview</h2>
                <QuickStats summary={summary} />
            </section>
        </div>
    );
};
