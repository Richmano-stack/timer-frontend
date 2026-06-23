'use client';

import { CircleHelp } from 'lucide-react';
import { AdminKpis } from '@/types/admin-dashboard';
import { cn } from '@/lib/utils';

type KpiTone = 'default' | 'active' | 'muted' | 'adherence';

function KpiCard({
  label,
  value,
  tone = 'default',
  helperText,
  tooltip,
}: {
  label: string;
  value: string | number;
  tone?: KpiTone;
  helperText?: string;
  tooltip?: string;
}) {
  const toneClass =
    tone === 'active'
      ? 'border-brand-accent/30 bg-brand-accent/10'
      : tone === 'muted'
        ? 'border-border bg-background'
        : tone === 'adherence'
          ? 'border-indigo-500/25 bg-indigo-500/5'
          : 'border-border bg-card';

  const valueClass =
    tone === 'active'
      ? 'text-indigo-600 dark:text-indigo-400'
      : tone === 'adherence'
        ? 'text-indigo-600 dark:text-indigo-400'
        : value === '—'
          ? 'text-muted-foreground'
          : 'text-foreground';

  return (
    <div
      className={cn('min-w-[132px] shrink-0 flex-1 rounded-lg border px-4 py-3', toneClass)}
      title={tooltip}
    >
      <div className="flex items-center gap-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {tooltip ? (
          <CircleHelp
            className="h-3 w-3 shrink-0 text-muted-foreground/70"
            aria-hidden
          />
        ) : null}
      </div>
      <p className={cn('mt-1 font-mono text-2xl font-black tabular-nums', valueClass)}>
        {value}
      </p>
      {helperText ? (
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}

function computeShiftCoveragePercent(kpis: AdminKpis): string {
  if (kpis.totalRegistered === 0) return '—';
  const pct = Math.round((kpis.activeShiftCount / kpis.totalRegistered) * 100);
  return `${pct}%`;
}

const SKELETON_COUNT = 7;

export function FloorKpiStrip({
  kpis,
  isLoading,
}: {
  kpis: AdminKpis | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <div
            key={index}
            className="h-[88px] min-w-[132px] shrink-0 flex-1 animate-pulse rounded-lg bg-border/60"
          />
        ))}
      </div>
    );
  }

  const coveragePercent = kpis ? computeShiftCoveragePercent(kpis) : '—';

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <KpiCard
        label="Total Registered"
        value={kpis?.totalRegistered ?? 0}
        tooltip="Active workspace members in your organization."
      />
      <KpiCard
        label="Active on Shift"
        value={kpis?.activeShiftCount ?? 0}
        tone="active"
        tooltip="Agents currently clocked in with an open shift."
      />
      <KpiCard
        label="Available"
        value={kpis?.availableCount ?? 0}
        tone="active"
        tooltip="On-shift agents in an available, ready-to-take-calls state."
      />
      <KpiCard
        label="On Break"
        value={kpis?.onBreakCount ?? 0}
        tone="muted"
        tooltip="On-shift agents in a break or non-productive pause status."
      />
      <KpiCard
        label="Off Floor / Absent"
        value={kpis?.offFloorCount ?? 0}
        tone="muted"
        tooltip="Registered members not currently clocked in or marked off floor."
      />
      <KpiCard
        label="Scheduled"
        value="—"
        tone="muted"
        helperText="Schedule data arrives in Phase 3"
        tooltip="Total scheduled headcount requires the schedule engine (Phase 3). Shown as unavailable until then."
      />
      <KpiCard
        label="Adherence"
        value={coveragePercent}
        tone="adherence"
        helperText="Proxy: on shift ÷ registered"
        tooltip="Adherence-style summary using on-shift agents divided by total registered members. Full schedule adherence arrives with the Phase 3 schedule engine."
      />
    </div>
  );
}
