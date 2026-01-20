'use client';

import React, { useEffect, useState } from 'react';
import { Status, StatusType } from '@/types';
import { cn } from '@/lib/utils';

interface StatusHeroProps {
    status: Status | null;
}

const statusConfig: Record<StatusType, { label: string; color: string; borderColor: string; shadowColor: string }> = {
    available: { label: 'Available', color: 'text-green-600', borderColor: 'border-green-200', shadowColor: 'shadow-green-100' },
    on_production: { label: 'On Production', color: 'text-black', borderColor: 'border-gray-200', shadowColor: 'shadow-gray-100' },
    meeting: { label: 'Meeting', color: 'text-blue-600', borderColor: 'border-blue-200', shadowColor: 'shadow-blue-100' },
    lunch_break: { label: 'Lunch Break', color: 'text-orange-600', borderColor: 'border-orange-200', shadowColor: 'shadow-orange-100' },
    short_break: { label: 'Short Break', color: 'text-orange-600', borderColor: 'border-orange-200', shadowColor: 'shadow-orange-100' },
    away: { label: 'Away', color: 'text-yellow-600', borderColor: 'border-yellow-200', shadowColor: 'shadow-yellow-100' },
    training: { label: 'Training', color: 'text-purple-600', borderColor: 'border-purple-200', shadowColor: 'shadow-purple-100' },
    off_duty: { label: 'Off Duty', color: 'text-gray-500', borderColor: 'border-gray-200', shadowColor: 'shadow-gray-100' },
};

export const StatusHero: React.FC<StatusHeroProps> = ({ status }) => {
    const currentStatus = status?.status_name || 'off_duty';
    const config = statusConfig[currentStatus];

    const [duration, setDuration] = useState<string>('00:00:00');

    useEffect(() => {
        if (!status?.start_time || currentStatus === 'off_duty') {
            setDuration((prev) => prev === '00:00:00' ? prev : '00:00:00');
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
        <div className={`relative overflow-hidden rounded-[24px] bg-white p-16 text-center shadow-[0px_10px_40px_rgba(0,0,0,0.05)] transition-all duration-500`}>
            <div className="relative z-10 flex flex-col items-center justify-center space-y-8">
                {/* Eyebrow */}
                <div className="flex items-center space-x-3">
                    <div className={`h-1.5 w-1.5 rounded-full ${currentStatus === 'on_production' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        Current Presence
                    </span>
                    <div className={`h-1.5 w-1.5 rounded-full ${currentStatus === 'on_production' ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                </div>

                {/* Main Timer */}
                <div className="font-mono text-8xl font-bold tracking-tighter text-gray-900 tabular-nums">
                    {duration}
                </div>

                {/* Status Badge */}
                <div className={`inline-flex items-center rounded-full border px-6 py-2.5 ${config.borderColor} ${config.color} bg-white shadow-sm`}>
                    <span className="relative flex h-2.5 w-2.5 mr-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentStatus === 'off_duty' ? 'bg-gray-400' : config.color.replace('text-', 'bg-')}`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${currentStatus === 'off_duty' ? 'bg-gray-500' : config.color.replace('text-', 'bg-')}`}></span>
                    </span>
                    <span className="text-sm font-bold uppercase tracking-wide">
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Background decoration */}
            <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-white to-white opacity-50 pointer-events-none" />
        </div>
    );
};
