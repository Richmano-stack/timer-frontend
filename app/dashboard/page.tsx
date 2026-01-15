import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { Status } from '@/types';
import { CurrentStatusCard } from '@/components/CurrentStatusCard';
import { StatusSwitcher } from '@/components/StatusSwitcher';
import { SummaryCards } from '@/components/SummaryCards';
import { LayoutDashboard } from 'lucide-react';

export default async function DashboardPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let currentStatus: Status | null = null;
    try {
        currentStatus = await api.get<Status>('/api/status/current', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        // If 404 or other error, assume offline or no active status
    }

    let summaryData: { summary: any[] } = { summary: [] };
    try {
        summaryData = await api.get<{ summary: any[] }>('/api/status/summary', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        // console.error('Failed to fetch summary', error);
    }

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                    <LayoutDashboard className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}</h1>
                    <p className="text-sm text-gray-500">Here's your activity overview for today.</p>
                </div>
            </div>

            <div className="space-y-8">
                {/* Top Section: Status & Switcher */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Current Status */}
                    <div className="lg:col-span-1">
                        <CurrentStatusCard status={currentStatus} />
                    </div>

                    {/* Right: Status Switcher */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Status</h3>
                            <StatusSwitcher currentStatus={currentStatus?.status_name || 'off_duty'} />
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Summary Stats */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 px-1">Today's Summary</h3>
                    <SummaryCards summary={summaryData.summary} />
                </div>
            </div>
        </div>
    );
}
