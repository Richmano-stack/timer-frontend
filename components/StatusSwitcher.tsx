'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { StatusType } from '@/types';

interface StatusSwitcherProps {
    currentStatus: StatusType;
}

const statuses: { label: string; value: StatusType; color: string }[] = [
    { label: 'Available', value: 'AVAILABLE', color: 'bg-green-500' },
    { label: 'Busy', value: 'BUSY', color: 'bg-red-500' },
    { label: 'Meeting', value: 'MEETING', color: 'bg-blue-500' },
    { label: 'Break', value: 'BREAK', color: 'bg-yellow-500' },
    { label: 'Offline', value: 'OFFLINE', color: 'bg-gray-500' },
];

export const StatusSwitcher: React.FC<StatusSwitcherProps> = ({ currentStatus }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<StatusType | null>(null);

    const handleStatusChange = async (newStatus: StatusType) => {
        if (newStatus === currentStatus) return;

        setIsLoading(newStatus);
        try {
            if (newStatus === 'OFFLINE') {
                await api.post('/api/status/stop', {});
            } else {
                await api.post('/api/status/change', { status: newStatus });
            }
            router.refresh();
        } catch (error) {
            console.error('Failed to change status', error);
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {statuses.map((status) => (
                <Button
                    key={status.value}
                    variant={currentStatus === status.value ? 'primary' : 'outline'}
                    className={`w-full justify-start ${currentStatus === status.value ? '' : 'hover:bg-gray-50'}`}
                    onClick={() => handleStatusChange(status.value)}
                    isLoading={isLoading === status.value}
                    disabled={isLoading !== null}
                >
                    <span className={`h-3 w-3 rounded-full mr-2 ${status.color}`} />
                    {status.label}
                </Button>
            ))}
        </div>
    );
};
