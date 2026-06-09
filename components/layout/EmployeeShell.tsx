'use client';

import { Logo } from '@/components/layout/AppLogo';
import { Sidebar, SidebarBody } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { IconLogout } from '@tabler/icons-react';
import { useState } from 'react';

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
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg py-2 text-sm text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            <IconLogout className="h-5 w-5 shrink-0" />
            <span>Log out</span>
          </button>
        </SidebarBody>
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
        {children}
      </main>
    </div>
  );
}
