'use client';

import React from 'react';
import { SummaryItem, StatusType } from '@/types';
import { Clock, Coffee, Monitor, Phone, UserCheck, Zap, GraduationCap, TrendingUp } from 'lucide-react';

interface QuickStatsProps {
    summary: SummaryItem[];
}

const statusConfig: Record<StatusType, {
    icon: React.ElementType;
    color: string;
}> = {
    available: { icon: UserCheck, color: 'text-green-600' },
    on_production: { icon: Monitor, color: 'text-rose-600' },
    meeting: { icon: Phone, color: 'text-blue-600' },
    lunch_break: { icon: Coffee, color: 'text-orange-600' },
    short_break: { icon: Coffee, color: 'text-amber-600' },
    away: { icon: Clock, color: 'text-yellow-600' },
    training: { icon: GraduationCap, color: 'text-purple-600' },
    off_duty: { icon: Zap, color: 'text-slate-600' },
};

export const QuickStats: React.FC<QuickStatsProps> = ({ summary }) => {
    const formatDuration = (msString: string) => {
        const ms = parseInt(msString);
        if (isNaN(ms)) return '0h 0m';
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const totalDurationMs = summary.reduce((acc, item) => {
        const val = parseInt(item.total_duration);
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Time Card */}
            <div className="bg-ink-primary text-surface rounded-card p-8 shadow-active flex flex-col justify-between min-h-[160px]">
                <div className="flex items-center justify-between">
                    <div className="p-2 bg-white/10 rounded-lg">
                        <TrendingUp size={20} className="text-white" />
                    </div>
                    <span className="eyebrow !text-white/60">Overall</span>
                </div>
                <div>
                    <p className="eyebrow !text-white/40 mb-1">Total Active Time</p>
                    <h3 className="text-3xl font-black tracking-tight tabular-nums">
                        {formatDuration(totalDurationMs.toString())}
                    </h3>
                </div>
            </div>

            {/* Individual Status Stats */}
            {summary.filter(item => item.status_name !== 'off_duty').map((item) => {
                const config = statusConfig[item.status_name as StatusType] || statusConfig.off_duty;
                const Icon = config.icon;

                return (
                    <div key={item.status_name} className="bg-surface rounded-card p-8 shadow-interaction flex flex-col justify-between min-h-[160px] hover:scale-[1.02] transition-transform">
                        <div className="flex items-center justify-between">
                            <div className={`p-2 bg-canvas ${config.color} rounded-lg`}>
                                <Icon size={20} />
                            </div>
                        </div>
                        <div>
                            <p className="eyebrow mb-1 capitalize">
                                {item.status_name.replace('_', ' ')}
                            </p>
                            <h3 className="text-2xl font-black text-ink-primary tracking-tight tabular-nums">
                                {formatDuration(item.total_duration)}
                            </h3>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
