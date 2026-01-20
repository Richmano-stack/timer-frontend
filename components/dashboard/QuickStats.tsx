'use client';

import React from 'react';
import { Card } from '@/components/ui/Card'; // Assuming this exists
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';
import { SummaryItem } from '@/types';

interface QuickStatsProps {
    summary: SummaryItem[];
}

const statusColors: Record<string, string> = {
    available: '#22C55E',
    on_production: '#EF4444',
    meeting: '#3B82F6',
    lunch_break: '#F97316',
    short_break: '#14B8A6',
    away: '#EAB308',
    training: '#6366F1',
    off_duty: '#6B7280',
};

export const QuickStats: React.FC<QuickStatsProps> = ({ summary }) => {
    // Process data for the chart
    const chartData = summary
        .filter(item => item.status_name !== 'off_duty' && parseInt(item.total_duration) > 0)
        .map(item => ({
            name: item.status_name.replace('_', ' '),
            value: Math.round(parseInt(item.total_duration) / 1000 / 60), // minutes
            fill: statusColors[item.status_name] || '#9CA3AF',
        }))
        .sort((a, b) => b.value - a.value);

    // Calculate totals
    const totalMs = summary.reduce((acc, item) => acc + parseInt(item.total_duration), 0);
    const productionMs = summary
        .filter(item => item.status_name === 'on_production')
        .reduce((acc, item) => acc + parseInt(item.total_duration), 0);

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const efficiency = totalMs > 0 ? Math.round((productionMs / totalMs) * 100) : 0;

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Today's Summary Card */}
            <div className="rounded-[24px] bg-white p-8 shadow-[0px_10px_40px_rgba(0,0,0,0.05)] lg:col-span-1">
                <h3 className="mb-6 text-lg font-bold text-gray-900">Today's Summary</h3>

                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-2xl bg-gray-50 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Active Time</p>
                                <p className="mt-2 text-3xl font-bold text-gray-900">{formatDuration(totalMs)}</p>
                            </div>
                            <div className="rounded-full bg-white p-3 shadow-sm">
                                <Activity className="h-6 w-6 text-black" />
                            </div>
                        </div>
                        <div className="mt-4 h-1.5 w-full rounded-full bg-gray-200">
                            <div className="h-1.5 rounded-full bg-black" style={{ width: '100%' }} />
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl bg-gray-50 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Efficiency</p>
                                <p className="mt-2 text-3xl font-bold text-gray-900">{efficiency}%</p>
                            </div>
                            <div className="rounded-full bg-white p-3 shadow-sm">
                                <TrendingUp className="h-6 w-6 text-green-500" />
                            </div>
                        </div>
                        <div className="mt-4 h-1.5 w-full rounded-full bg-gray-200">
                            <div
                                className="h-1.5 rounded-full bg-green-500 transition-all duration-500"
                                style={{ width: `${efficiency}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Breakdown Chart */}
            <div className="rounded-[24px] bg-white p-8 shadow-[0px_10px_40px_rgba(0,0,0,0.05)] lg:col-span-2">
                <h3 className="mb-2 text-lg font-bold text-gray-900">Status Breakdown</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                            innerRadius="20%"
                            outerRadius="100%"
                            barSize={20}
                            data={chartData}
                            startAngle={180}
                            endAngle={0}
                        >
                            <RadialBar
                                label={{ position: 'insideStart', fill: '#fff' }}
                                background
                                dataKey="value"
                                cornerRadius={10}
                            />
                            <Legend
                                iconSize={10}
                                layout="vertical"
                                verticalAlign="middle"
                                wrapperStyle={{ right: 0, top: '50%', transform: 'translate(0, -50%)' }}
                            />
                            <Tooltip
                                formatter={(value: number | undefined) => [`${Math.floor((value || 0) / 60)}h ${(value || 0) % 60}m`, 'Duration']}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
