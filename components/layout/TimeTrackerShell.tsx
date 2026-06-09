'use client';

import { Logo } from '@/components/layout/AppLogo';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { IconChartBar, IconClock, IconCode, IconLayoutDashboard } from '@tabler/icons-react';
import { useState } from 'react';

const navLinks = [
  {
    label: 'Time Card',
    href: '/employee/track',
    icon: (
      <IconClock className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
    ),
  },
  {
    label: 'Floor Monitor',
    href: '/admin/overview',
    icon: (
      <IconLayoutDashboard className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
    ),
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: (
      <IconChartBar className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />
    ),
  },
  {
    label: 'API Sandbox',
    href: '/developer/sandbox',
    icon: <IconCode className="h-5 w-5 shrink-0 text-neutral-700 dark:text-neutral-200" />,
  },
];

export function TimeTrackerShell({
  children,
  sidebarPanel,
  employeeName,
}: {
  children: React.ReactNode;
  sidebarPanel: React.ReactNode;
  employeeName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800',
        'h-dvh w-screen max-w-none rounded-none border-none'
      )}
    >
      <Sidebar animate={false} open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-6">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <Logo />
            <div className="mt-6 flex flex-col gap-1">
              {navLinks.map((link) => (
                <SidebarLink key={link.href} link={link} />
              ))}
            </div>
            <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-700">
              {sidebarPanel}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: employeeName,
                href: '/employee/track',
                icon: (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sage text-xs font-bold text-ice">
                    {employeeName.charAt(0).toUpperCase()}
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-ice text-sage">
        {children}
      </main>
    </div>
  );
}
