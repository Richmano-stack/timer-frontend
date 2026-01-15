'use client';

import React from 'react';
import { StatusHistoryItem, StatusType } from '@/types';
import { Card } from '@/components/ui/Card';
import { ClientDate } from '@/components/ClientDate';
import { Clock, Coffee, Monitor, Phone, UserCheck, UserX, Calendar } from 'lucide-react';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface StatusHistoryTableProps {
    history: StatusHistoryItem[];
    currentPage: number;
    totalPages: number;
    initialStartDate?: string;
    initialEndDate?: string;
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

export const StatusHistoryTable: React.FC<StatusHistoryTableProps> = ({
    history,
    currentPage,
    totalPages,
    initialStartDate = '',
    initialEndDate = ''
}) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [startDate, setStartDate] = React.useState(initialStartDate);
    const [endDate, setEndDate] = React.useState(initialEndDate);

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
        updateUrl({ startDate: start, endDate: end, page: '1' });
    };

    const onPageChange = (page: number) => {
        updateUrl({ page: page.toString() });
    };

    const onExport = () => {
        // Mock export functionality for now
        console.log('Exporting data...');
        alert('Export functionality coming soon!');
    };

    const handleQuickFilter = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);

        const endStr = end.toISOString().split('T')[0];
        const startStr = start.toISOString().split('T')[0];

        handleFilterChange(startStr, endStr);
    };

    return (
        <div className="space-y-4">
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
                    <Button variant="outline" size="sm" onClick={onExport} className="flex items-center gap-2">
                        <Download size={14} />
                        Export
                    </Button>
                </div>
            </div>

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
                                                <ClientDate date={Number(item.start_time)} />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {item.end_time ? (
                                                <div className="flex items-center">
                                                    <Calendar size={14} className="mr-1.5 text-gray-400" />
                                                    <ClientDate date={Number(item.end_time)} />
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

            <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-1 justify-between sm:hidden">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-700">
                            Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                        </p>
                    </div>
                    <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                            <button
                                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="sr-only">Previous</span>
                                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="sr-only">Next</span>
                                <ChevronRight className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </nav>
                    </div>
                </div>
            </div>
        </div>
    );
};
