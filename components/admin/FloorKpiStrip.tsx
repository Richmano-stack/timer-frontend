'use client';

import { AdminKpis, StatusBreakdownItem } from '@/types/admin-dashboard';

function KpiCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'available' | 'break' | 'muted';
}) {
  const toneClass =
    tone === 'available'
      ? 'border-sage/20 bg-mint/50'
      : tone === 'break'
        ? 'border-mauve/30 bg-mauve/10'
        : tone === 'muted'
          ? 'border-mist bg-white'
          : 'border-mist bg-white';

  return (
    <div className={`min-w-[120px] flex-1 rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-sage/50">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black tabular-nums text-sage">{value}</p>
    </div>
  );
}

export function FloorKpiStrip({
  kpis,
  statusBreakdown,
  isLoading,
}: {
  kpis: AdminKpis | null;
  statusBreakdown: StatusBreakdownItem[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="h-[76px] min-w-[120px] flex-1 animate-pulse rounded-lg bg-mist/60" />
        ))}
      </div>
    );
  }

  const channelStatuses = statusBreakdown.filter(
    (item) =>
      item.name !== 'Available' &&
      item.name !== 'Off Floor' &&
      item.isProductive &&
      item.count > 0
  );

  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <KpiCard label="On Shift" value={kpis?.activeShiftCount ?? 0} tone="available" />
      <KpiCard label="Available" value={kpis?.availableCount ?? 0} tone="available" />
      {channelStatuses.map((item) => (
        <KpiCard key={item.name} label={item.name} value={item.count} />
      ))}
      <KpiCard label="On Break" value={kpis?.onBreakCount ?? 0} tone="break" />
      <KpiCard label="Off Floor" value={kpis?.offFloorCount ?? 0} tone="muted" />
      <KpiCard label="Registered" value={kpis?.totalRegistered ?? 0} tone="muted" />
    </div>
  );
}
