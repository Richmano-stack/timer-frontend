'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { StatusType } from '@/types';
import { Coffee, Monitor, Phone, UserCheck, UserX, Zap, GraduationCap, Clock, ArrowRight } from 'lucide-react';

interface StatusControlGridProps {
    currentStatus: StatusType;
}

const statuses: {
    label: string;
    value: StatusType;
    icon: React.ElementType;
    color: string;
    bg: string;
    description: string;
    gradient: string;
}[] = [
        {
            label: 'Available',
            value: 'available',
            icon: UserCheck,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            description: 'Ready to work',
            gradient: 'from-emerald-500 to-teal-600'
        },
        {
            label: 'On Production',
            value: 'on_production',
            icon: Monitor,
            color: 'text-rose-600',
            bg: 'bg-rose-50',
            description: 'Deep focus mode',
            gradient: 'from-rose-500 to-red-600'
        },
        {
            label: 'Meeting',
            value: 'meeting',
            icon: Phone,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            description: 'In a call',
            gradient: 'from-blue-500 to-indigo-600'
        },
        {
            label: 'Lunch Break',
            value: 'lunch_break',
            icon: Coffee,
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            description: 'Meal time',
            gradient: 'from-orange-500 to-amber-600'
        },
        {
            label: 'Short Break',
            value: 'short_break',
            icon: Coffee,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            description: 'Quick breather',
            gradient: 'from-amber-400 to-orange-500'
        },
        {
            label: 'Away',
            value: 'away',
            icon: Clock,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
            description: 'Stepped away',
            gradient: 'from-yellow-400 to-amber-500'
        },
        {
            label: 'Training',
            value: 'training',
            icon: GraduationCap,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            description: 'Learning session',
            gradient: 'from-purple-500 to-violet-600'
        },
        {
            label: 'Off Duty',
            value: 'off_duty',
            icon: Zap,
            color: 'text-slate-600',
            bg: 'bg-slate-50',
            description: 'End shift',
            gradient: 'from-slate-400 to-slate-600'
        },
    ];

export const StatusControlGrid: React.FC<StatusControlGridProps> = ({ currentStatus }) => {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                            group relative flex flex-col p-5 rounded-2xl border-2 transition-all duration-300 text-left
                            ${isActive
                                ? `bg-white border-slate-900 shadow-lg scale-[1.02] z-10`
                                : `bg-white border-slate-100 hover:border-slate-200 hover:shadow-md`
                            }
                            ${isLoading !== null && !isLoadingThis ? 'opacity-50 grayscale' : ''}
                            ${isLoading !== null ? 'cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`
                                p-3 rounded-xl transition-colors duration-300
                                ${isActive ? `bg-gradient-to-br ${status.gradient} text-white` : `bg-slate-50 text-slate-400 group-hover:text-slate-600`}
                            `}>
                                {isLoadingThis ? (
                                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Icon size={24} strokeWidth={2} />
                                )}
                            </div>

                            {isActive && (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active
                                </div>
                            )}
                        </div>

                        <div>
                            <h3 className={`font-bold transition-colors ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                                {status.label}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                {status.description}
                            </p>
                        </div>

                        <div className={`
                            mt-4 flex items-center text-[10px] font-bold uppercase tracking-widest transition-all duration-300
                            ${isActive ? 'text-slate-900 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}
                        `}>
                            {isActive ? 'Current Status' : 'Switch to status'}
                            {!isActive && <ArrowRight size={10} className="ml-1" />}
                        </div>

                        {/* Hover effect background */}
                        {!isActive && (
                            <div className={`absolute inset-0 bg-gradient-to-br ${status.gradient} opacity-0 group-hover:opacity-[0.02] rounded-2xl transition-opacity duration-300`} />
                        )}
                    </button>
                );
            })}
        </div>
    );
};
