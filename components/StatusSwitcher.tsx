'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusType } from '@/types';
import { Coffee, Monitor, Phone, UserCheck, UserX, Briefcase, GraduationCap, Clock } from 'lucide-react';

interface StatusSwitcherProps {
    currentStatus: StatusType;
}

const statuses: { label: string; value: StatusType; icon: React.ElementType; color: string }[] = [
    { label: 'Available', value: 'available', icon: UserCheck, color: 'text-green-600' },
    { label: 'Lunch Break', value: 'lunch_break', icon: Coffee, color: 'text-orange-600' },
    { label: 'On Production', value: 'on_production', icon: Monitor, color: 'text-blue-600' },
    { label: 'Away', value: 'away', icon: Clock, color: 'text-yellow-600' },
    { label: 'Meeting', value: 'meeting', icon: Phone, color: 'text-purple-600' },
    { label: 'Short Break', value: 'short_break', icon: Coffee, color: 'text-teal-600' },
    { label: 'Training', value: 'training', icon: GraduationCap, color: 'text-indigo-600' },
    { label: 'Off Duty', value: 'off_duty', icon: Briefcase, color: 'text-gray-600' },
];

export const StatusSwitcher: React.FC<StatusSwitcherProps> = ({ currentStatus }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<StatusType | null>(null);

    const handleStatusChange = async (newStatus: StatusType) => {
        if (newStatus === currentStatus) return;

        setIsLoading(newStatus);
        try {
            if (newStatus === 'off_duty') {
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {statuses.map((status) => {
                const Icon = status.icon;
                const isActive = currentStatus === status.value;
                const isLoadingThis = isLoading === status.value;

                return (
                    <button
                        key={status.value}
                        onClick={() => handleStatusChange(status.value)}
                        disabled={isLoading !== null}
                        className={`
                            relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200
                            ${isActive
                                ? `bg-white border-${status.color.split('-')[1]}-200 ring-2 ring-${status.color.split('-')[1]}-500 shadow-sm`
                                : `bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300`
                            }
                            ${isLoading !== null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        <div className={`p-3 rounded-full mb-3 ${isActive ? 'bg-opacity-10 bg-current' : 'bg-gray-100'} ${status.color}`}>
                            {isLoadingThis ? (
                                <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Icon size={24} />
                            )}
                        </div>
                        <span className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                            {status.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
