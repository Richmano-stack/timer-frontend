'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Status, StatusType } from '@/types';

interface StatusHeroProps {
    status: Status | null;
}

const statusConfig: Record<StatusType, {
    label: string;
    pillStyle: string;
    labelStyle: string;
}> = {
    available: {
        label: 'Available',
        pillStyle: 'bg-green-50 border-green-100',
        labelStyle: 'text-green-700 font-bold'
    },
    on_production: {
        label: 'On Production',
        pillStyle: 'bg-rose-50 border-rose-100',
        labelStyle: 'text-rose-700 font-bold'
    },
    meeting: {
        label: 'Meeting',
        pillStyle: 'bg-blue-50 border-blue-100',
        labelStyle: 'text-blue-700 font-bold'
    },
    lunch_break: {
        label: 'Lunch Break',
        pillStyle: 'bg-orange-50 border-orange-100',
        labelStyle: 'text-orange-700 font-bold'
    },
    short_break: {
        label: 'Short Break',
        pillStyle: 'bg-amber-50 border-amber-100',
        labelStyle: 'text-amber-700 font-bold'
    },
    away: {
        label: 'Away',
        pillStyle: 'bg-yellow-50 border-yellow-100',
        labelStyle: 'text-yellow-700 font-bold'
    },
    training: {
        label: 'Training',
        pillStyle: 'bg-purple-50 border-purple-100',
        labelStyle: 'text-purple-700 font-bold'
    },
    off_duty: {
        label: 'Off Duty',
        pillStyle: 'bg-slate-50 border-slate-100',
        labelStyle: 'text-slate-700 font-bold'
    },
};

export const StatusHero: React.FC<StatusHeroProps> = ({ status }) => {
    const currentStatus = status?.status_name || 'off_duty';
    const config = statusConfig[currentStatus];
    const [duration, setDuration] = useState<string>('00:00:00');
    const requestRef = useRef<number>(undefined);

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!status?.start_time || currentStatus === 'off_duty') {
            setDuration('00:00:00');
            return;
        }

        // Robust parsing of start_time (handles both numeric strings and ISO strings)
        const rawStartTime = status.start_time;
        const parsedTime = Number(rawStartTime);
        const startTime = !isNaN(parsedTime) && rawStartTime !== ''
            ? parsedTime
            : new Date(rawStartTime).getTime();

        if (isNaN(startTime)) {
            setDuration('00:00:00');
            return;
        }

        const animate = () => {
            const now = Date.now();
            const diff = Math.max(0, now - startTime);
            setDuration(formatTime(diff));
            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [status, currentStatus]);

    return (
        <div className="bg-surface rounded-hero p-16 shadow-interaction flex flex-col items-center justify-center text-center">
            {/* Pulse-Pill Status Indicator */}
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${config.pillStyle} mb-8`}>
                <div className={`w-2 h-2 rounded-full ${currentStatus === 'off_duty' ? 'bg-slate-400' : 'bg-green-500 animate-pulse'}`} />
                <span className={`text-xs ${config.labelStyle} uppercase tracking-widest`}>
                    {config.label}
                </span>
            </div>

            {/* Timer Display */}
            <div className="text-[5rem] font-black text-ink-primary tabular-nums tracking-tighter leading-none mb-4">
                {duration}
            </div>

            <p className="text-ink-secondary font-medium">
                Current session duration
            </p>
        </div>
    );
};
