'use client';

import { Logo } from '@/components/layout/AppLogo';
import { Sidebar, SidebarBody } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { IconLogout, IconLayoutDashboard } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { isAdminRole } from '@/lib/organization/roles';

export function EmployeeShell({
  children,
  sidebarPanel,
  onLogout,
}: {
  children: React.ReactNode;
  sidebarPanel: React.ReactNode;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkRole() {
      try {
        const res = await authClient.organization.getActiveMemberRole();
        if (res.data?.role && isAdminRole(res.data.role)) {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error('Failed to check member role', err);
      }
    }
    checkRole();
  }, []);

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden border border-border bg-background md:flex-row',
        'h-dvh w-screen max-w-none rounded-none border-none'
      )}
    >
      <Sidebar animate={false} open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-6">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo />
            <div className="mt-6">{sidebarPanel}</div>
          </div>
          <div className="flex flex-col gap-1">
            {isAdmin && (
              <Link
                href="/admin/overview"
                className="flex w-full items-center gap-2 rounded-lg py-2 text-sm text-muted-foreground transition hover:bg-background hover:text-foreground"
              >
                <IconLayoutDashboard className="h-5 w-5 shrink-0" />
                <span>Admin Dashboard</span>
              </Link>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-lg py-2 text-sm text-muted-foreground transition hover:bg-background hover:text-foreground"
            >
              <IconLogout className="h-5 w-5 shrink-0" />
              <span>Log out</span>
            </button>
          </div>
        </SidebarBody>
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        {children}
      </main>
    </div>
  );
}
