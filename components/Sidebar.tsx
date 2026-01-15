'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from '@/types';

interface SidebarProps {
    user: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ user }) => {
    const pathname = usePathname();

    if (!user) return null;

    const navigation = [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Profile', href: '/profile' },
        { name: 'Status History', href: '/status/history' },
        { name: 'Analytics', href: '/analytics' },
    ];

    if (user.role === 'admin' || user.role === 'supervisor') {
        navigation.push({ name: 'Team Status', href: '/admin/team' });
    }

    if (user.role === 'admin') {
        navigation.push({ name: 'User Management', href: '/admin/users' });
    }

    return (
        <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
            <div className="flex-1 flex flex-col min-h-0 border-r border-gray-200 bg-white">
                <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                    <div className="flex items-center flex-shrink-0 px-4">
                        <h1 className="text-xl font-bold text-gray-900">Timer App</h1>
                    </div>
                    <nav className="mt-5 flex-1 px-2 space-y-1">
                        {navigation.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    ${isActive
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </div>
    );
};
