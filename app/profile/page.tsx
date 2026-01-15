import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { User } from '@/types';
import { UserProfileForm } from '@/components/UserProfileForm';
import { UserCircle } from 'lucide-react';

export default async function ProfilePage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let user: User | null = null;
    try {
        user = await api.get<User>('/api/auth/me', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        console.error('Failed to fetch user', error);
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="text-red-500 mb-2">Error loading profile</div>
                <div className="text-gray-500 text-sm">Please try refreshing the page</div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8 flex items-center space-x-3">
                <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
                    <UserCircle className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                    <p className="text-sm text-gray-500">Manage your account settings and preferences.</p>
                </div>
            </div>

            <UserProfileForm user={user} />
        </div>
    );
}
