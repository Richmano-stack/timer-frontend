'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Status, StatusType } from '@/types';

interface CurrentStatusCardProps {
    status: Status | null;
}

const statusColors: Record<StatusType, string> = {
    AVAILABLE: 'bg-green-100 text-green-800',
    BUSY: 'bg-red-100 text-red-800',
    MEETING: 'bg-blue-100 text-blue-800',
    BREAK: 'bg-yellow-100 text-yellow-800',
    OFFLINE: 'bg-gray-100 text-gray-800',
};

export const CurrentStatusCard: React.FC<CurrentStatusCardProps> = ({ status }) => {
    const currentStatus = status?.status || 'OFFLINE';
    const colorClass = statusColors[currentStatus] || statusColors.OFFLINE;

    // Calculate duration if needed, but for now just show start time
    const startTime = status?.startedAt ? new Date(status.startedAt).toLocaleTimeString() : '-';

    return (
        <Card title="Current Status">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colorClass}`}>
                        {currentStatus}
                    </span>
                </div>
                <div className="text-sm text-gray-500">
                    Started at: <span className="font-medium text-gray-900">{startTime}</span>
                </div>
            </div>
        </Card>
    );
};
