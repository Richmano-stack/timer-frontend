'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export const LogoutButton: React.FC<{ className?: string }> = ({ className }) => {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await api.post('/api/auth/logout', {});
        } catch (error) {
            console.error('Logout failed', error);
        } finally {
            // Always redirect to login, even if API fails (maybe session expired)
            router.push('/login');
            router.refresh();
        }
    };

    return (
        <Button
            variant="ghost"
            onClick={handleLogout}
            className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${className}`}
        >
            Sign out
        </Button>
    );
};
