import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { User } from '@/types';
import { UsersTable } from '@/components/UsersTable';

export default async function UsersPage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

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
