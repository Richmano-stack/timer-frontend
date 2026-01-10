'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { User } from '@/types';

interface UserProfileFormProps {
    user: User;
}

export const UserProfileForm: React.FC<UserProfileFormProps> = ({ user }) => {
    const router = useRouter();
    const [username, setUsername] = useState(user.username);
    // Email usually not editable or requires verification, but I'll allow it for now if API supports
    const [email, setEmail] = useState('email' in user ? (user as any).email : '');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        try {
            await api.put('/api/auth/me', { username, email });
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            router.refresh();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card title="Profile Settings">
            <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />

                {/* Assuming User type has email, if not I should check types/index.ts */}
                {/* types/index.ts User interface: id, username, role, createdAt, updatedAt, isActive. No email? */}
                {/* I'll check types/index.ts again. */}

                <div className="flex justify-end">
                    <Button type="submit" isLoading={isLoading}>
                        Save Changes
                    </Button>
                </div>

                {message && (
                    <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {message.text}
                    </div>
                )}
            </form>
        </Card>
    );
};
