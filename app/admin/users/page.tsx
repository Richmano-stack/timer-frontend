import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { User } from '@/types';
import { UsersTable } from '@/components/UsersTable';

import { redirect } from 'next/navigation';

export default async function UsersPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let currentUser: User | null = null;
    try {
        currentUser = await api.get<User>('/api/auth/me', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        redirect('/login');
    }

    if (!currentUser || currentUser.role !== 'admin') {
        redirect('/dashboard');
    }

    let users: User[] = [];
    try {
        users = await api.get<User[]>('/api/admin/users', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        console.error('Failed to fetch users', error);
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
            <UsersTable users={users} />
        </div>
    );
}
