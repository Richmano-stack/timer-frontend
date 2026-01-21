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
        <aside className="hidden md:flex md:w-[280px] md:flex-col md:fixed md:inset-y-0 bg-transparent border-r border-gray-100">
            <div className="flex flex-col flex-1 min-h-0 px-8 py-12">
                <div className="flex items-center mb-12">
                    <h1 className="text-2xl font-black tracking-tighter text-ink-primary">NEXUMA</h1>
                </div>

                <nav className="flex-1 space-y-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`
                                    block text-sm transition-all duration-200
                                    ${isActive
                                        ? 'text-ink-primary font-bold'
                                        : 'text-ink-secondary hover:text-ink-primary'}
                                `}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto">
                    <LogoutButton className="!p-0 !bg-transparent !text-red-500 hover:!text-red-600 font-medium text-sm" />
                </div>
            </div>
        </aside>
    );
};
