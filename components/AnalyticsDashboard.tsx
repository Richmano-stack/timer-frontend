'use client';

import React, { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusHistoryItem } from '@/types';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Download, Calendar } from 'lucide-react';

interface AnalyticsDashboardProps {
    history: StatusHistoryItem[];
    initialStartDate?: string;
    initialEndDate?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
    history,
    initialStartDate = '',
    initialEndDate = ''
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);

    const updateUrl = (newParams: Record<string, string>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(newParams).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleFilterChange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
        updateUrl({ startDate: start, endDate: end });
    };

    const handleQuickFilter = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        const endStr = end.toISOString().split('T')[0];
        const startStr = start.toISOString().split('T')[0];

        handleFilterChange(startStr, endStr);
    };

    // Process data for Pie Chart (Total Duration by Status)
    const pieData = React.useMemo(() => {
        const durationByStatus: Record<string, number> = {};
        history.forEach(item => {
            const duration = item.duration_ms ? Number(item.duration_ms) : 0;
            if (duration > 0) {
                durationByStatus[item.status_name] = (durationByStatus[item.status_name] || 0) + duration;
            }
        });

        return Object.entries(durationByStatus).map(([name, value]) => ({
            name: name.replace('_', ' '),
            value: Math.round(value / 1000 / 60) // minutes
        }));
    }, [history]);

    // Process data for Bar Chart (Daily Breakdown)
    const barData = React.useMemo(() => {
        const dailyData: Record<string, Record<string, number>> = {};

        history.forEach(item => {
            const date = new Date(Number(item.start_time)).toLocaleDateString();
            if (!dailyData[date]) {
                dailyData[date] = {};
            }
            const duration = item.duration_ms ? Number(item.duration_ms) : 0;
            if (duration > 0) {
                dailyData[date][item.status_name] = (dailyData[date][item.status_name] || 0) + Math.round(duration / 1000 / 60);
            }
        });

        return Object.entries(dailyData).map(([date, statuses]) => ({
            date,
            ...statuses
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [history]);

    const formatDuration = (minutes: number | string | undefined) => {
        if (minutes === undefined || minutes === null) return '0h 0m';
        const mins = typeof minutes === 'string' ? parseInt(minutes, 10) : minutes;
        if (isNaN(mins)) return '0h 0m';

        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleQuickFilter(0)}>Today</Button>
                    <Button variant="outline" size="sm" onClick={() => handleQuickFilter(7)}>Last 7 Days</Button>
                    <Button variant="outline" size="sm" onClick={() => handleQuickFilter(30)}>Last 30 Days</Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-end">
                    <div className="flex gap-2">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">From</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleFilterChange(e.target.value, endDate)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-9"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">To</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => handleFilterChange(startDate, e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-9"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <Card className="p-6 border-none shadow-md ring-1 ring-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Distribution</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value: number | string | undefined) => formatDuration(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Summary Stats */}
                <Card className="p-6 border-none shadow-md ring-1 ring-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary Statistics</h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-indigo-50 rounded-lg">
                                <p className="text-sm text-indigo-600 font-medium">Total Time</p>
                                <p className="text-2xl font-bold text-indigo-900">
                                    {formatDuration(pieData.reduce((acc, item) => acc + item.value, 0))}
                                </p>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg">
                                <p className="text-sm text-green-600 font-medium">Active Days</p>
                                <p className="text-2xl font-bold text-green-900">
                                    {barData.length}
                                </p>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 pt-4">
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Top Activities</h4>
                            <ul className="space-y-2">
                                {pieData.sort((a, b) => b.value - a.value).slice(0, 3).map((item, index) => (
                                    <li key={index} className="flex items-center justify-between text-sm">
                                        <span className="flex items-center">
                                            <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                            <span className="capitalize text-gray-700">{item.name}</span>
                                        </span>
                                        <span className="font-medium text-gray-900">{formatDuration(item.value)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Card>

                {/* Bar Chart */}
                <Card className="lg:col-span-2 p-6 border-none shadow-md ring-1 ring-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity Breakdown</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                                <RechartsTooltip formatter={(value: number | string | undefined) => formatDuration(value)} />
                                <Legend />
                                {pieData.map((item, index) => (
                                    <Bar key={item.name} dataKey={item.name.replace(' ', '_')} stackId="a" fill={COLORS[index % COLORS.length]} name={item.name} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
};
