import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { User } from '@/types';
import { UsersTable } from '@/components/UsersTable';

import { redirect } from 'next/navigation';

export default async function UsersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    const resolvedSearchParams = await searchParams;

    const page = Number(resolvedSearchParams.page) || 1;
    const search = resolvedSearchParams.search as string || '';
    const role = resolvedSearchParams.role as string || '';
    const status = resolvedSearchParams.status as string || '';
    const limit = 10;

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
    let total = 0;
    try {
        const queryParams = new URLSearchParams();
        queryParams.set('page', page.toString());
        queryParams.set('limit', limit.toString());
        if (search) queryParams.set('search', search);
        if (role) queryParams.set('role', role);
        if (status) queryParams.set('status', status);

        const response = await api.get<{ data: User[], meta: { total: number } }>(`/api/admin/users?${queryParams.toString()}`, {
            headers: { Cookie: cookieHeader }
        });

        if (Array.isArray(response)) {
            users = response;
            total = response.length;
        } else {
            users = response.data;
            total = response.meta.total;
        }
    } catch (error) {
        console.error('Failed to fetch users', error);
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-500">Manage user accounts, roles, and permissions.</p>
            </div>
            <UsersTable
                users={users}
                currentPage={page}
                totalPages={totalPages || 1}
                initialSearch={search}
                initialRole={role}
                initialStatus={status}
            />
        </div>
    );
}
