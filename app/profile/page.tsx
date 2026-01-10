import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { User } from '@/types';
import { UserProfileForm } from '@/components/UserProfileForm';

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
        return <div>Error loading profile</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
            <UserProfileForm user={user} />
        </div>
    );
}
