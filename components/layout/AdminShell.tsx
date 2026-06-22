'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';
import {
  IconChartBar,
  IconLayoutDashboard,
  IconLogout,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react';
import { Logo } from '@/components/layout/AppLogo';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sidebar, SidebarBody } from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'Floor Monitor',
    href: '/admin/overview',
    icon: IconLayoutDashboard,
  },
  {
    label: 'Team',
    href: '/admin/team',
    icon: IconUsers,
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: IconSettings,
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: IconChartBar,
  },
] as const;

function AdminNavLink({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function AdminShell({
  children,
  organizationName,
}: {
  children: React.ReactNode;
  organizationName?: string;
}) {
  const pathname = usePathname();

  const handleLogout = useCallback(async () => {
    await authClient.signOut();
    window.location.href = '/login';
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <Sidebar animate={false}>
        <SidebarBody className="justify-between gap-4">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <Logo />
            {organizationName && (
              <p className="truncate px-1 text-xs font-medium text-muted-foreground">
                {organizationName}
              </p>
            )}
            <Separator />
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <AdminNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                />
              ))}
            </nav>
          </div>
          <div className="flex flex-col gap-2">
            <Separator />
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-3 px-3"
              onClick={handleLogout}
            >
              <IconLogout className="h-4 w-4 shrink-0" />
              Log out
            </Button>
          </div>
        </SidebarBody>
      </Sidebar>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
