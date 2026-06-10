'use client';

import { LogoIcon } from '@/components/layout/AppLogo';
import { BRAND_NAME } from '@/lib/constants/brand';

export function AuthBrand() {
  return (
    <div className="mb-2 flex items-center justify-center gap-2">
      <LogoIcon />
      <span className="text-sm font-semibold tracking-tight text-foreground">{BRAND_NAME}</span>
    </div>
  );
}
