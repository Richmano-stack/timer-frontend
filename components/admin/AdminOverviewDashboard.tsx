'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AgentDetailDrawer } from '@/components/admin/AgentDetailDrawer';
import { FloorKpiStrip } from '@/components/admin/FloorKpiStrip';
import { ExceptionsPanel, LiveFloorTable } from '@/components/admin/LiveFloorTable';
import { Toast, ToastStack } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import { AdminOverviewResponse, FloorStatusFilter } from '@/types/admin-dashboard';

const DEV_COMPANY_ID =
  process.env.NEXT_PUBLIC_DEV_COMPANY_ID ?? '00000000-0000-4000-8000-000000000010';

const POLL_INTERVAL_MS = 15_000;

export function AdminOverviewDashboard() {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FloorStatusFilter>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; code?: string | null } | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const params = new URLSearchParams({ companyId: DEV_COMPANY_ID });
      const data = await api.get<AdminOverviewResponse>(
        `/api/admin/overview?${params.toString()}`
      );
      setOverview(data);
      setLastUpdated(new Date());
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to load floor monitor',
        code: err instanceof ApiError ? err.code : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadOverview]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ice text-sage">
      <header className="shrink-0 border-b border-mist bg-sage px-6 py-4 text-ice">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ice/70">
              Organization Admin
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Floor Monitor</h1>
            <p className="mt-1 text-sm text-ice/80">
              Real-time agent status for call-center operations
              {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="rounded-lg border border-ice/30 bg-ice/10 px-4 py-2 text-sm font-semibold text-ice transition hover:bg-ice/20"
          >
            Reports &amp; Export
          </Link>
        </div>
      </header>

      <div className="shrink-0 border-b border-mist px-6 py-4">
        <FloorKpiStrip
          kpis={overview?.kpis ?? null}
          statusBreakdown={overview?.statusBreakdown ?? []}
          isLoading={isLoading}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <LiveFloorTable
            agents={overview?.floorAgents ?? []}
            filter={filter}
            onFilterChange={setFilter}
            isLoading={isLoading}
            onSelectAgent={setSelectedUserId}
          />
        </div>
        <ExceptionsPanel
          alerts={overview?.complianceAlerts ?? []}
          isLoading={isLoading}
          onSelectAgent={setSelectedUserId}
        />
      </div>

      <AgentDetailDrawer
        open={selectedUserId !== null}
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />

      {toast && (
        <ToastStack>
          <Toast
            message={toast.message}
            code={toast.code}
            variant="error"
            onDismiss={() => setToast(null)}
          />
        </ToastStack>
      )}
    </div>
  );
}
