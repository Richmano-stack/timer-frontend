import React, { useState } from 'react';
import { api } from '@/lib/api';
import { StatusType } from '@/types';
import { STATUS_CONFIG } from './constants';
import { StatusCard } from './StatusCard';

interface Props {
    currentStatus: StatusType;
    onStatusChange: (newStatus: StatusType) => void;
}

export const StatusControlGrid = ({ currentStatus, onStatusChange }: Props) => {
    const [loadingStatus, setLoadingStatus] = useState<StatusType | null>(null);

    const handleUpdate = async (newStatus: StatusType) => {
        if (newStatus === currentStatus || loadingStatus) return;

        setLoadingStatus(newStatus);
        try {
            await api.post('/api/status/update', { status: newStatus });
            onStatusChange(newStatus); // Update local truth only after server success
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setLoadingStatus(null);
        }
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATUS_CONFIG.map((s) => (
                <StatusCard
                    key={s.value}
                    config={s}
                    isActive={currentStatus === s.value}
                    isLoading={loadingStatus === s.value}
                    onClick={() => handleUpdate(s.value)}
                />
            ))}
        </div>
    );
};