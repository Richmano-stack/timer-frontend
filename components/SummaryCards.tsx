'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';

interface SummaryData {
    totalDuration: number; // in seconds
    statusBreakdown: Record<string, number>; // status -> duration
}

interface SummaryCardsProps {
    summary: SummaryData;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
                <div className="text-sm font-medium text-gray-500 truncate">Total Time Today</div>
                <div className="mt-1 text-3xl font-semibold text-gray-900">
                    {formatDuration(summary.totalDuration)}
                </div>
            </Card>

            {Object.entries(summary.statusBreakdown || {}).map(([status, duration]) => (
                <Card key={status}>
                    <div className="text-sm font-medium text-gray-500 truncate capitalize">
                        {status.toLowerCase()}
                    </div>
                    <div className="mt-1 text-3xl font-semibold text-gray-900">
                        {formatDuration(duration)}
                    </div>
                </Card>
            ))}
        </div>
    );
};
