'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from '@/types';
import { LogoutButton } from './LogoutButton';

interface SidebarProps {
    user: User | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ user }) => {
    const pathname = usePathname();

    if (!user) return null;

    const navigation = [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Profile', href: '/profile' },
        { name: 'Status History', href: '/history' },
        { name: 'Analytics', href: '/analytics' },
    ];

    if (user.role === 'admin' || user.role === 'supervisor') {
        navigation.push({ name: 'Team Status', href: '/team' });
    }

    if (user.role === 'admin') {
        navigation.push({ name: 'User Management', href: '/admin/users' });
    }

    return (
        <aside className="hidden md:flex md:w-[280px] md:flex-col bg-[#D9D9D9] rounded-2xl h-full transition-all duration-300">
            <div className="flex flex-col flex-1 min-h-0 px-6 py-8">
                <div className="flex items-center mb-10 pl-2">
                    <h1 className="text-2xl font-black tracking-tighter text-ink-primary">NEXUMA</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`
                                    block px-4 py-3 rounded-md text-sm transition-all duration-200
                                    ${isActive
                                        ? 'bg-white text-ink-primary font-bold shadow-sm border border-gray-100'
                                        : 'text-ink-secondary hover:text-ink-primary hover:bg-gray-50'}
                                `}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto pl-2">
                    <LogoutButton className="!p-0 !bg-transparent !text-red-500 hover:!text-red-600 font-medium text-sm" />
                </div>
            </div>
        </aside>
    );
};
