'use client';

import React from 'react';
import { StatusHistoryItem, StatusType } from '@/types';
import { Card } from '@/components/ui/Card';
import { Clock, Coffee, Monitor, Phone, UserCheck, UserX, Calendar } from 'lucide-react';

interface StatusHistoryTableProps {
    history: StatusHistoryItem[];
}

const statusConfig: Record<StatusType, { color: string; icon: React.ElementType; label: string; bg: string }> = {
    available: { color: 'text-green-700', icon: UserCheck, label: 'Available', bg: 'bg-green-50' },
    on_production: { color: 'text-red-700', icon: UserX, label: 'On Production', bg: 'bg-red-50' },
    meeting: { color: 'text-blue-700', icon: Phone, label: 'Meeting', bg: 'bg-blue-50' },
    lunch_break: { color: 'text-orange-700', icon: Coffee, label: 'Lunch Break', bg: 'bg-orange-50' },
    short_break: { color: 'text-orange-700', icon: Coffee, label: 'Short Break', bg: 'bg-orange-50' },
    away: { color: 'text-yellow-700', icon: Clock, label: 'Away', bg: 'bg-yellow-50' },
    training: { color: 'text-purple-700', icon: Monitor, label: 'Training', bg: 'bg-purple-50' },
    off_duty: { color: 'text-gray-700', icon: UserX, label: 'Off Duty', bg: 'bg-gray-50' },
};

export const StatusHistoryTable: React.FC<StatusHistoryTableProps> = ({ history }) => {
    return (
        <Card className="overflow-hidden border-none shadow-md ring-1 ring-gray-100">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Started At
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Ended At
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Duration
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {history.map((item) => {
                            const config = statusConfig[item.status_name] || statusConfig.off_duty;
                            const Icon = config.icon;

                            return (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className={`p-1.5 rounded-full mr-3 ${config.bg} ${config.color}`}>
                                                <Icon size={16} />
                                            </div>
                                            <span className={`text-sm font-medium ${config.color}`}>
                                                {config.label}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        <div className="flex items-center">
                                            <Calendar size={14} className="mr-1.5 text-gray-400" />
                                            {new Date(Number(item.start_time)).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {item.end_time ? (
                                            <div className="flex items-center">
                                                <Calendar size={14} className="mr-1.5 text-gray-400" />
                                                {new Date(Number(item.end_time)).toLocaleString()}
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                                        {item.duration_ms ? (
                                            <div className="flex items-center">
                                                <Clock size={14} className="mr-1.5 text-gray-400" />
                                                {(() => {
                                                    const seconds = Math.floor(item.duration_ms / 1000);
                                                    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
                                                })()}
                                            </div>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {history.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="p-3 bg-gray-100 rounded-full mb-3">
                                            <Clock size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-base font-medium text-gray-900">No history found</p>
                                        <p className="mt-1 text-sm text-gray-500">Your status changes will appear here.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};
