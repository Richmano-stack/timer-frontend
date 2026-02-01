'use client';

import React, { useEffect, useState } from 'react';
import { StatusHero } from './StatusHero';
import { StatusControlGrid } from './StatusControlGrid';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { Status, SummaryItem, StatusType } from '@/types';

interface DashboardContentProps {
    initialStatus: Status | null;
    initialSummary: SummaryItem[];
}

export const DashboardContent: React.FC<DashboardContentProps> = ({ initialStatus, initialSummary }) => {
    const [status, setStatus] = useState<Status | null>(initialStatus);
    const [summary, setSummary] = useState<SummaryItem[]>(initialSummary);

    useEffect(() => {
        setStatus(initialStatus);
        setSummary(initialSummary);
    }, [initialStatus, initialSummary]);
    const handleStatusChangeSuccess = (newStatusName: StatusType) => {

        setStatus(prev => ({
            ...(prev || { id: 'temp', user_id: 'current' }),
            status_name: newStatusName,
            start_time: Date.now().toString()
        } as Status));
    };

    return (
        <div className="space-y-12">
            <section>
                <StatusHero status={status} />
            </section>
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
