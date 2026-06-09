'use client';

import { LogoIcon } from '@/components/layout/AppLogo';

export function AuthBrand() {
  return (
    <div className="mb-2 flex items-center justify-center gap-2">
      <LogoIcon />
      <span className="text-sm font-semibold tracking-tight text-foreground">Timer App</span>
    </div>
  );
}
