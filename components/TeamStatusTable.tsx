'use client';

import React from 'react';
import { TeamStatus } from '@/types';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Search, RefreshCw, Filter } from 'lucide-react';
import { ClientDate } from '@/components/ClientDate';

interface TeamStatusTableProps {
    initialTeamStatus: TeamStatus[];
}

export const TeamStatusTable: React.FC<TeamStatusTableProps> = ({ initialTeamStatus }) => {
    const [teamStatus, setTeamStatus] = React.useState<TeamStatus[]>(initialTeamStatus);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [isAutoRefresh, setIsAutoRefresh] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);

    const fetchTeamStatus = async () => {
        setIsLoading(true);
        try {
            const data = await api.get<TeamStatus[]>('/api/admin/team-status');
            setTeamStatus(data);
        } catch (error) {
            console.error('Failed to refresh team status', error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isAutoRefresh) {
            interval = setInterval(fetchTeamStatus, 30000); // Refresh every 30 seconds
        }
        return () => clearInterval(interval);
    }, [isAutoRefresh]);

    const filteredStatus = teamStatus.filter(item => {
        const matchesSearch = item.username.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || item.currentStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-1 w-full sm:w-auto gap-2">
                    <div className="relative flex-1 max-w-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-gray-400" />
                        </div>
                        <Input
                            placeholder="Search team members..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-9"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-9"
                    >
                        <option value="all">All Statuses</option>
                        <option value="available">Available</option>
                        <option value="on_production">On Production</option>
                        <option value="meeting">Meeting</option>
                        <option value="lunch_break">Lunch Break</option>
                        <option value="away">Away</option>
                        <option value="off_duty">Off Duty</option>
                    </select>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="auto-refresh"
                            checked={isAutoRefresh}
                            onChange={(e) => setIsAutoRefresh(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="auto-refresh" className="text-sm text-gray-600">Auto-refresh (30s)</label>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchTeamStatus}
                        isLoading={isLoading}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex flex-col">
                <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                        <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Current Status
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Last Change
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredStatus.map((item) => (
                                        <tr key={item.userId} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{item.username}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${item.currentStatus === 'available' ? 'bg-green-100 text-green-800' :
                                                        item.currentStatus === 'on_production' ? 'bg-red-100 text-red-800' :
                                                            item.currentStatus === 'lunch_break' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-800'}`}>
                                                    {item.currentStatus.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <ClientDate date={item.lastStatusChange} />
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredStatus.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <Filter size={24} className="text-gray-300 mb-2" />
                                                    <p>No team members found matching your filters.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
