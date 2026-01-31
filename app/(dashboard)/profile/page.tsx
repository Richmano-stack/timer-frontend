import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { User } from '@/types';
import { UserProfileForm } from '@/components/UserProfileForm';
import { UserCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let user: User | null = null;
    try {
        user = await api.get<User>('/api/auth/me', {
            headers: { Cookie: cookieHeader }
        });
    } catch (error) {
        redirect('/login');
    }

    if (!user) {
        redirect('/login');
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
