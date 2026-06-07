import { ReactNode } from 'react';

export function DashboardHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 rounded-lg bg-sage px-6 py-5 text-ice">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ice/70">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ice/80">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
