'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Clock, PieChart } from 'lucide-react';

interface SummaryItem {
    status_name: string;
    total_duration: string; // Backend returns bigint as string
}

interface SummaryCardsProps {
    summary: SummaryItem[];
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
    const formatDuration = (msString: string) => {
        const ms = parseInt(msString);
        const seconds = Math.floor(ms / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const totalDurationMs = summary.reduce((acc, item) => acc + parseInt(item.total_duration), 0);

    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-indigo-100 text-sm font-medium">Total Time</p>
                            <p className="mt-2 text-3xl font-bold">{formatDuration(totalDurationMs.toString())}</p>
                        </div>
                        <div className="p-3 bg-white bg-opacity-20 rounded-lg">
                            <Clock size={24} className="text-white" />
                        </div>
                    </div>
                </div>
            </Card>

            {summary.map((item) => (
                <Card key={item.status_name} className="hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium capitalize">{item.status_name.replace('_', ' ')}</p>
                                <p className="mt-2 text-2xl font-semibold text-gray-900">{formatDuration(item.total_duration)}</p>
                            </div>
                            <div className="p-2 bg-gray-50 rounded-full">
                                <PieChart size={20} className="text-gray-400" />
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
};
