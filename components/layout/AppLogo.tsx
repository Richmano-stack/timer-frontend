'use client';

import { useSidebar } from '@/components/ui/sidebar';
import { motion } from 'motion/react';
import Link from 'next/link';

export const Logo = () => {
  const { open, animate } = useSidebar();

  return (
    <Link
      href="/employee/track"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-foreground"
    >
      <LogoIcon />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{
          opacity: animate ? (open ? 1 : 0) : 1,
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
        }}
        className="font-medium whitespace-pre text-foreground"
      >
        TimeTracker
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-brand-accent" />
  );
};
