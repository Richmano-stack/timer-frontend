'use client';

import React, { useState, memo } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusType } from '@/types';
import { Coffee, Monitor, Phone, UserCheck, UserX, Zap, GraduationCap, Clock } from 'lucide-react';

interface StatusControlGridProps {
    currentStatus: StatusType;
    onStatusChange?: (newStatus: StatusType) => void;
}

const statuses: {
    label: string;
    value: StatusType;
    icon: React.ElementType;
}[] = [
        { label: 'Available', value: 'available', icon: UserCheck },
        { label: 'On Production', value: 'on_production', icon: Monitor },
        { label: 'Meeting', value: 'meeting', icon: Phone },
        { label: 'Lunch Break', value: 'lunch_break', icon: Coffee },
        { label: 'Short Break', value: 'short_break', icon: Coffee },
        { label: 'Away', value: 'away', icon: Clock },
        { label: 'Training', value: 'training', icon: GraduationCap },
        { label: 'Off Duty', value: 'off_duty', icon: Zap },
    ];

const StatusCard = memo(({
    status,
    isActive,
    isLoading,
    onClick
}: {
    status: typeof statuses[0],
    isActive: boolean,
    isLoading: boolean,
    onClick: () => void
}) => {
    const Icon = status.icon;

    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className={`
                group relative flex flex-col p-8 rounded-card transition-all duration-300 text-left min-h-[160px]
                ${isActive
                    ? 'bg-ink-primary text-surface shadow-active scale-[1.02] z-10'
                    : 'bg-surface text-ink-primary shadow-interaction hover:scale-[1.02] hover:-translate-y-1'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <div className="flex items-start justify-between mb-auto">
                <div className={`
                    p-3 rounded-xl transition-colors duration-300
                    ${isActive ? 'bg-white/10 text-white' : 'bg-canvas text-ink-secondary group-hover:text-ink-primary'}
                `}>
                    <Icon size={24} strokeWidth={2} />
                </div>

                {isActive && (
                    <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                )}
            </div>

            <div>
                <h3 className="font-bold text-lg leading-tight">
                    {status.label}
                </h3>
                <p className={`text-xs font-medium mt-1 ${isActive ? 'text-white/60' : 'text-ink-secondary'}`}>
                    {isActive ? 'Current Status' : 'Switch to status'}
                </p>
            </div>
        </button>
    );
});

StatusCard.displayName = 'StatusCard';

export const StatusControlGrid: React.FC<StatusControlGridProps> = ({ currentStatus, onStatusChange }) => {
    const router = useRouter();
    const [loadingStatus, setLoadingStatus] = useState<StatusType | null>(null);

    const handleStatusChange = async (newStatus: StatusType) => {
        if (newStatus === currentStatus) return;

        setLoadingStatus(newStatus);
        try {
            if (newStatus === 'off_duty') {
                await api.post('/api/status/stop', {});
            } else {
                await api.post('/api/status/change', { status: newStatus });
            }

            // Trigger optimistic update if provided
            if (onStatusChange) {
                onStatusChange(newStatus);
            }

            /* router.refresh(); */
        } catch (error) {
            console.error('Failed to change status', error);
        } finally {
            setLoadingStatus(null);
        }
    };

    console.log({ currentStatus });

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statuses.map((status) => (
                <StatusCard
                    key={status.value}
                    status={status}
                    isActive={currentStatus === status.value}
                    isLoading={loadingStatus !== null}
                    onClick={() => handleStatusChange(status.value)}
                />
            ))}
        </div>
    );
};
