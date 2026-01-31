'use client';

import { UserCustom } from '@/lib/auth-client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { authClient } from "@/lib/auth-client";
import { LogoutButton } from './LogoutButton';

const SidebarSkeleton = () => (
    <aside className="hidden md:flex md:w-[280px] md:flex-col bg-[#D9D9D9] rounded-2xl h-full transition-all duration-300 animate-pulse">
        <div className="flex flex-col flex-1 px-6 py-8">
            <div className="h-8 w-32 bg-gray-300 rounded mb-10"></div>
            <nav className="flex-1 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 bg-gray-200 rounded-md"></div>
                ))}
            </nav>
            <div className="mt-auto h-5 w-20 bg-gray-300 rounded"></div>
        </div>
    </aside>
);

export const Sidebar = () => {
    const pathname = usePathname();
    // Better-Auth hook handles loading and session state automatically
    const { data: session, isPending } = authClient.useSession();

    console.log("AUTH_CHECK:", { isPending, session });

    if (isPending) return <SidebarSkeleton />;
    if (!session) {
        console.warn("SIDEBAR_HIDDEN: No session found. Check cookies.");
        return null;
    }


    const user = session.user as unknown as UserCustom;
    // Define navigation with 'roles' metadata
    console.log("CURRENT_USER_ROLE:", user.role);
    const navConfig = [
        { name: 'Dashboard', href: '/dashboard', roles: ['agent', 'supervisor', 'admin'] },
        { name: 'Profile', href: '/profile', roles: ['agent', 'supervisor', 'admin'] },
        { name: 'Status History', href: '/history', roles: ['agent', 'supervisor', 'admin'] },
        { name: 'Analytics', href: '/analytics', roles: ['agent', 'supervisor', 'admin'] },
        { name: 'Team Status', href: '/team', roles: ['supervisor', 'admin'] },
        { name: 'User Management', href: '/admin/users', roles: ['admin'] },
    ];

    // Filter based on the agent's role
    const visibleNavigation = navConfig.filter(item =>
        item.roles.includes(user.role as string)
    );

    return (
        <aside className="hidden md:flex md:w-[280px] md:flex-col bg-[#D9D9D9] rounded-2xl h-full transition-all duration-300">
            <div className="flex flex-col flex-1 min-h-0 px-6 py-8">
                <div className="flex items-center mb-10 pl-2">
                    <h1 className="text-2xl font-black tracking-tighter text-ink-primary">NEXUMA</h1>
                </div>

                <nav className="flex-1 space-y-2">
                    {visibleNavigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    block px-4 py-3 rounded-md text-sm transition-all duration-200
                                    ${isActive
                                        ? 'bg-white text-ink-primary font-bold shadow-sm border border-gray-100'
                                        : 'text-ink-secondary hover:text-ink-primary hover:bg-gray-50'}
                                `}
                            >
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto pl-2">
                    <LogoutButton className="!p-0 !bg-transparent !text-red-500 hover:!text-red-600 font-medium text-sm" />
                </div>
            </div>
        </aside>
    );
};

