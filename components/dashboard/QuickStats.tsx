'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { SummaryItem, StatusType } from '@/types';
import { Clock, Coffee, Monitor, Phone, UserCheck, UserX, Zap, GraduationCap, TrendingUp, BarChart3 } from 'lucide-react';

interface QuickStatsProps {
    summary: SummaryItem[];
}

const statusConfig: Record<StatusType, {
    color: string;
    icon: React.ElementType;
    bg: string;
    gradient: string;
}> = {
    available: {
        color: 'text-emerald-600',
        icon: UserCheck,
        bg: 'bg-emerald-50',
        gradient: 'from-emerald-500 to-teal-600'
    },
    on_production: {
        color: 'text-rose-600',
        icon: Monitor,
        bg: 'bg-rose-50',
        gradient: 'from-rose-500 to-red-600'
    },
    meeting: {
        color: 'text-blue-600',
        icon: Phone,
        bg: 'bg-blue-50',
        gradient: 'from-blue-500 to-indigo-600'
    },
    lunch_break: {
        color: 'text-orange-600',
        icon: Coffee,
        bg: 'bg-orange-50',
        gradient: 'from-orange-500 to-amber-600'
    },
    short_break: {
        color: 'text-amber-600',
        icon: Coffee,
        bg: 'bg-amber-50',
        gradient: 'from-amber-400 to-orange-500'
    },
    away: {
        color: 'text-yellow-600',
        icon: Clock,
        bg: 'bg-yellow-50',
        gradient: 'from-yellow-400 to-amber-500'
    },
    training: {
        color: 'text-purple-600',
        icon: GraduationCap,
        bg: 'bg-purple-50',
        gradient: 'from-purple-500 to-violet-600'
    },
    off_duty: {
        color: 'text-slate-600',
        icon: Zap,
        bg: 'bg-slate-50',
        gradient: 'from-slate-400 to-slate-600'
    },
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
            <Card className="relative overflow-hidden border-none shadow-lg bg-slate-900 text-white p-6 group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 to-purple-600/20 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <TrendingUp size={20} className="text-indigo-300" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 bg-indigo-500/20 px-2 py-1 rounded-full">Overall</span>
                    </div>
                    <div className="mt-auto">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Active Time</p>
                        <h3 className="text-3xl font-black tracking-tight">{formatDuration(totalDurationMs.toString())}</h3>
                    </div>
                </div>
            </Card>

            {/* Individual Status Stats */}
            {summary.filter(item => item.status_name !== 'off_duty').map((item) => {
                const config = statusConfig[item.status_name as StatusType] || statusConfig.off_duty;
                const Icon = config.icon;

                return (
                    <Card key={item.status_name} className="relative overflow-hidden border-none shadow-md bg-white p-6 hover:shadow-lg transition-all duration-300 group">
                        <div className="relative flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 ${config.bg} ${config.color} rounded-lg group-hover:scale-110 transition-transform`}>
                                    <Icon size={20} />
                                </div>
                                <div className="p-1.5 bg-slate-50 rounded-md">
                                    <BarChart3 size={14} className="text-slate-300" />
                                </div>
                            </div>
                            <div className="mt-auto">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1 truncate capitalize">
                                    {item.status_name.replace('_', ' ')}
                                </p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                                    {formatDuration(item.total_duration)}
                                </h3>
                            </div>
                        </div>
                        {/* Subtle decorative gradient */}
                        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient} opacity-20`} />
                    </Card>
                );
            })}
        </div>
    );
};
