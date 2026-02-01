import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { User } from '@/types';
import { UserProfileForm } from '@/components/UserProfileForm';
import { UserCircle } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    let userData: User | null = null;

    try {
        // 1. Define the Better-Auth session shape
        const response = await api.get<{ user: User; session: any }>('/api/auth/get-session', {
            headers: { Cookie: cookieHeader }
        });

        // 2. Extract the user specifically
        if (response && response.user) {
            userData = response.user;
        }
    } catch (error) {
        console.error("Failed to fetch session data", error);
    }

    if (!userData) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500">Session expired or data unavailable.</p>
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

            <UserProfileForm user={userData} />
        </div>
    );
}
