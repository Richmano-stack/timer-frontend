'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api'; // Assuming this exists based on StatusSwitcher
import { StatusType } from '@/types';
import {
    CheckCircle2,
    Utensils,
    Briefcase,
    Users,
    Clock,
    Power,
    Coffee,
    Monitor,
    GraduationCap
} from 'lucide-react';

interface StatusControlGridProps {
    currentStatus: StatusType;
}

const statusItems: {
    label: string;
    value: StatusType;
    icon: React.ElementType;
    colorClass: string;
    bgClass: string;
    description?: string;
}[] = [
        {
            label: 'Available',
            value: 'available',
            icon: CheckCircle2,
            colorClass: 'text-green-600',
            bgClass: 'bg-green-50 hover:bg-green-100',
            description: 'Ready for new tasks'
        },
        {
            label: 'Lunch Break',
            value: 'lunch_break',
            icon: Utensils,
            colorClass: 'text-orange-600',
            bgClass: 'bg-orange-50 hover:bg-orange-100',
            description: 'Out for lunch'
        },
        {
            label: 'On Production',
            value: 'on_production',
            icon: Briefcase,
            colorClass: 'text-red-600',
            bgClass: 'bg-red-50 hover:bg-red-100',
            description: 'Focused work'
        },
        {
            label: 'Meeting',
            value: 'meeting',
            icon: Users,
            colorClass: 'text-blue-600',
            bgClass: 'bg-blue-50 hover:bg-blue-100',
            description: 'In a discussion'
        },
        {
            label: 'Away',
            value: 'away',
            icon: Clock,
            colorClass: 'text-yellow-600',
            bgClass: 'bg-yellow-50 hover:bg-yellow-100',
            description: 'Temporarily unavailable'
        },
        {
            label: 'Short Break',
            value: 'short_break',
            icon: Coffee,
            colorClass: 'text-teal-600',
            bgClass: 'bg-teal-50 hover:bg-teal-100',
            description: 'Quick recharge'
        },
        {
            label: 'Training',
            value: 'training',
            icon: GraduationCap,
            colorClass: 'text-indigo-600',
            bgClass: 'bg-indigo-50 hover:bg-indigo-100',
            description: 'Learning & Dev'
        },
        {
            label: 'Off Duty',
            value: 'off_duty',
            icon: Power,
            colorClass: 'text-gray-600',
            bgClass: 'bg-gray-100 hover:bg-gray-200',
            description: 'End of shift'
        }
    ];

export const StatusControlGrid: React.FC<StatusControlGridProps> = ({ currentStatus }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<StatusType | null>(null);

    const handleStatusChange = async (newStatus: StatusType) => {
        if (newStatus === currentStatus) return;

        setIsLoading(newStatus);
        const timestamp = new Date().toISOString();

        try {
            if (newStatus === 'off_duty') {
                await api.post('/api/status/stop', { timestamp });
            } else {
                await api.post('/api/status/change', { status: newStatus, timestamp });
            }
            router.refresh();
        } catch (error) {
            console.error('Failed to change status', error);
        } finally {
            setIsLoading(null);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statusItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentStatus === item.value;
                const isProcessing = isLoading === item.value;
                const isDisabled = isLoading !== null;

                return (
                    <button
                        key={item.value}
                        onClick={() => handleStatusChange(item.value)}
                        disabled={isDisabled}
                        className={`
                            group relative flex items-start space-x-4 rounded-[20px] p-6 text-left transition-all duration-300
                            ${isActive
                                ? 'bg-black text-white shadow-lg ring-2 ring-black ring-offset-2'
                                : `bg-white text-gray-900 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1`
                            }
                            ${isDisabled && !isActive ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        <div className={`
                            flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300
                            ${isActive
                                ? 'bg-white/20 text-white'
                                : `${item.bgClass} ${item.colorClass}`
                            }
                        `}>
                            {isProcessing ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                                <Icon size={24} strokeWidth={2} />
                            )}
                        </div>

                        <div className="flex-1">
                            <h3 className={`text-base font-bold tracking-tight ${isActive ? 'text-white' : 'text-gray-900'}`}>
                                {item.label}
                            </h3>
                            <p className={`mt-1 text-sm font-medium ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>
                                {item.description}
                            </p>
                        </div>

                        {isActive && (
                            <div className="absolute right-4 top-4 h-2 w-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)] animate-pulse" />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
