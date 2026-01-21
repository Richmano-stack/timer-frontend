'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Status, StatusType } from '@/types';
import { Clock, Coffee, Monitor, Phone, UserCheck, UserX, Zap } from 'lucide-react';
import { ClientDate } from '@/components/ClientDate';

interface StatusHeroProps {
    status: Status | null;
}

const statusConfig: Record<StatusType, {
    color: string;
    icon: React.ElementType;
    label: string;
    bg: string;
    description: string;
    gradient: string;
}> = {
    available: {
        color: 'text-emerald-600',
        icon: UserCheck,
        label: 'Available',
        bg: 'bg-emerald-50',
        description: 'You are online and ready to work.',
        gradient: 'from-emerald-500 to-teal-600'
    },
    on_production: {
        color: 'text-rose-600',
        icon: UserX,
        label: 'On Production',
        bg: 'bg-rose-50',
        description: 'Focus mode active. Handling production tasks.',
        gradient: 'from-rose-500 to-red-600'
    },
    meeting: {
        color: 'text-blue-600',
        icon: Phone,
        label: 'In a Meeting',
        bg: 'bg-blue-50',
        description: 'Currently in a scheduled call or meeting.',
        gradient: 'from-blue-500 to-indigo-600'
    },
    lunch_break: {
        color: 'text-orange-600',
        icon: Coffee,
        label: 'Lunch Break',
        bg: 'bg-orange-50',
        description: 'Taking some time for a meal.',
        gradient: 'from-orange-500 to-amber-600'
    },
    short_break: {
        color: 'text-amber-600',
        icon: Coffee,
        label: 'Short Break',
        bg: 'bg-amber-50',
        description: 'Stepping away for a quick breather.',
        gradient: 'from-amber-400 to-orange-500'
    },
    away: {
        color: 'text-yellow-600',
        icon: Clock,
        label: 'Away',
        bg: 'bg-yellow-50',
        description: 'Temporarily away from your desk.',
        gradient: 'from-yellow-400 to-amber-500'
    },
    training: {
        color: 'text-purple-600',
        icon: Monitor,
        label: 'Training',
        bg: 'bg-purple-50',
        description: 'Engaged in learning or development.',
        gradient: 'from-purple-500 to-violet-600'
    },
    off_duty: {
        color: 'text-slate-500',
        icon: Zap,
        label: 'Off Duty',
        bg: 'bg-slate-50',
        description: 'Shift has ended. See you next time!',
        gradient: 'from-slate-400 to-slate-600'
    },
};

export const StatusHero: React.FC<StatusHeroProps> = ({ status }) => {
    const currentStatus = status?.status_name || 'off_duty';
    const config = statusConfig[currentStatus];
    const Icon = config.icon;

    const [duration, setDuration] = useState<string>('00:00:00');

    useEffect(() => {
        if (!status?.start_time || currentStatus === 'off_duty') {
            setDuration('00:00:00');
            return;
        }

        const startTime = new Date(Number(status.start_time)).getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const diff = Math.max(0, now - startTime);

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setDuration(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [status, currentStatus]);

    return (
        <Card className="relative overflow-hidden border-none shadow-xl bg-white group">
            <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-500`} />

            <div className="relative p-8 sm:p-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className={`relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${config.gradient} shadow-lg shadow-current/20 text-white`}>
                            <Icon size={40} strokeWidth={1.5} />
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                                <div className={`w-3 h-3 rounded-full ${currentStatus === 'off_duty' ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold uppercase tracking-widest ${config.color}`}>Current Status</span>
                            </div>
                            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                                {config.label}
                            </h2>
                            <p className="text-slate-500 mt-1 font-medium">
                                {config.description}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col md:items-end">
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Session Duration</div>
                        <div className="text-6xl font-black text-slate-900 tabular-nums tracking-tighter">
                            {duration}
                        </div>
                        {status?.start_time && currentStatus !== 'off_duty' && (
                            <div className="mt-2 flex items-center text-sm font-medium text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                                <Clock size={14} className="mr-2" />
                                Started at <span className="text-slate-600 ml-1"><ClientDate date={Number(status.start_time)} options={{ hour: '2-digit', minute: '2-digit' }} /></span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Decorative element */}
            <div className={`absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-gradient-to-br ${config.gradient} opacity-[0.05] rounded-full blur-3xl`} />
        </Card>
    );
};
