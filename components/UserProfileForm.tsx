'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { User } from '@/types';
import { Camera, Mail, User as UserIcon, Calendar } from 'lucide-react';
import { ClientDate } from '@/components/ClientDate';

interface UserProfileFormProps {
    user: User;
}

export const UserProfileForm: React.FC<UserProfileFormProps> = ({ user }) => {
    const router = useRouter();
    const [username, setUsername] = useState(user.username);
    // Email is not in User interface, so we default to empty string or handle it if it exists in runtime
    const [email, setEmail] = useState((user as any).email || '');
    const [firstName, setFirstName] = useState((user as any).firstName || '');
    const [lastName, setLastName] = useState((user as any).lastName || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        if (newPassword && newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match' });
            return;
        }

        try {
            await api.put('/api/auth/me', {
                username,
                email,
                firstName,
                lastName,
                ...(newPassword ? { password: newPassword } : {})
            });
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            setNewPassword('');
            setConfirmPassword('');
            router.refresh();
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="overflow-hidden border-none shadow-md ring-1 ring-gray-100">
            <div className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold ring-4 ring-white shadow-sm">
                            {username.charAt(0).toUpperCase()}
                        </div>
                        <button className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full shadow-md border border-gray-200 text-gray-500 hover:text-indigo-600 transition-colors">
                            <Camera size={16} />
                        </button>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{user.username}</h2>
                        <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                        <div className="flex items-center mt-2 text-xs text-gray-400">
                            <Calendar size={12} className="mr-1" />
                            <span>Member since <ClientDate date={user.createdAt} options={{ year: 'numeric', month: 'numeric', day: 'numeric' }} /></span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <Input
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="First Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <Input
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Last Name"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <UserIcon size={18} className="text-gray-400" />
                                </div>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail size={18} className="text-gray-400" />
                                </div>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10"
                                    placeholder="your@email.com"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">Change Password</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <Input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="New Password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                    <Input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm Password"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            {/* Placeholder for future "Delete Account" or similar */}
                        </div>
                        <Button type="submit" isLoading={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            Save Changes
                        </Button>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-md flex items-center ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                            {message.text}
                        </div>
                    )}
                </form>
            </div>
        </Card>
    );
};
