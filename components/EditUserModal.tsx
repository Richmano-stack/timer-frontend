'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { User } from '@/types';

interface EditUserModalProps {
    user: User;
    onClose: () => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose }) => {
    const router = useRouter();
    const [username, setUsername] = useState(user.username);
    const [firstName, setFirstName] = useState((user as any).firstName || '');
    const [lastName, setLastName] = useState((user as any).lastName || '');
    const [email, setEmail] = useState((user as any).email || '');
    const [role, setRole] = useState(user.role);
    const [password, setPassword] = useState(''); // Optional password reset
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const payload: any = {
                username,
                role,
                firstName,
                lastName,
                email
            };
            if (password) payload.password = password;

            await api.put(`/api/admin/users/${user.id}`, payload);
            router.refresh();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update user');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal title="Edit User" isOpen={true} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                    />
                    <Input
                        label="Last Name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                    />
                </div>
                <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                    label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                <Input
                    label="New Password (optional)"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                        <option value="user">User</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end space-x-3 mt-5">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" isLoading={isLoading}>Save Changes</Button>
                </div>
            </form>
        </Modal>
    );
};
