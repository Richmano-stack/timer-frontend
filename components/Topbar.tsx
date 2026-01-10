'use client';

import React from 'react';
import { User } from '@/types';
import { LogoutButton } from './LogoutButton';

interface TopbarProps {
    user: User | null;
}

export const Topbar: React.FC<TopbarProps> = ({ user }) => {
    if (!user) return null;

    return (
        <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-gray-200">
            <div className="flex-1 px-4 flex justify-between">
                <div className="flex-1 flex">
                    {/* Search or other items could go here */}
                </div>
                <div className="ml-4 flex items-center md:ml-6">
                    <span className="text-sm font-medium text-gray-700 mr-4">
                        {user.username} ({user.role})
                    </span>
                    <LogoutButton />
                </div>
            </div>
        </div>
    );
};
