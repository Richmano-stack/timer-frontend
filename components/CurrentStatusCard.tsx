'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Status, StatusType } from '@/types';
import { Clock, Coffee, Monitor, Phone, UserCheck, UserX } from 'lucide-react';

interface CurrentStatusCardProps {
    status: Status | null;
}

const statusConfig: Record<StatusType, { color: string; icon: React.ElementType; label: string; bg: string }> = {
    available: { color: 'text-green-600', icon: UserCheck, label: 'Available', bg: 'bg-green-50' },
    on_production: { color: 'text-red-600', icon: UserX, label: 'On Production', bg: 'bg-red-50' },
    meeting: { color: 'text-blue-600', icon: Phone, label: 'In a Meeting', bg: 'bg-blue-50' },
    lunch_break: { color: 'text-orange-600', icon: Coffee, label: 'Lunch Break', bg: 'bg-orange-50' },
    short_break: { color: 'text-orange-600', icon: Coffee, label: 'Short Break', bg: 'bg-orange-50' },
    away: { color: 'text-yellow-600', icon: Clock, label: 'Away', bg: 'bg-yellow-50' },
    training: { color: 'text-purple-600', icon: Monitor, label: 'Training', bg: 'bg-purple-50' },
    off_duty: { color: 'text-gray-500', icon: Monitor, label: 'Off Duty', bg: 'bg-gray-50' },
};

export const CurrentStatusCard: React.FC<CurrentStatusCardProps> = ({ status }) => {
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
        <Card className="overflow-hidden border-none shadow-md ring-1 ring-gray-100">
            <div className={`p-6 ${config.bg} transition-colors duration-300`}>
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Current Status</h2>
                        <div className="mt-2 flex items-center space-x-3">
                            <div className={`p-2 rounded-full bg-white shadow-sm ${config.color}`}>
                                <Icon size={24} />
                            </div>
                            <span className={`text-2xl font-bold ${config.color}`}>
                                {config.label}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">Duration</div>
                        <div className="mt-1 font-mono text-3xl font-bold text-gray-900 tracking-tight">
                            {duration}
                        </div>
                    </div>
                </div>

                {status?.start_time && currentStatus !== 'off_duty' && (
                    <div className="mt-6 flex items-center text-sm text-gray-500">
                        <Clock size={14} className="mr-1.5" />
                        Started at {new Date(Number(status.start_time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>
        </Card>
    );
};
