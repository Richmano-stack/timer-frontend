'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  useOverviewStream,
  type OverviewConnectionMode,
} from '@/app/(dashboard)/admin/overview/_components/useOverviewStream';
import { AgentDetailDrawer } from '@/components/admin/AgentDetailDrawer';
import { FloorKpiStrip } from '@/components/admin/FloorKpiStrip';
import { ExceptionsPanel, LiveFloorTable } from '@/components/admin/LiveFloorTable';
import { Badge } from '@/components/ui/badge';
import { Toast, ToastStack } from '@/components/ui/Toast';
import { api, ApiError } from '@/lib/api';
import {
  AdminOverviewResponse,
  ComplianceAlert,
  FloorStatusFilter,
} from '@/types/admin-dashboard';

function ConnectionBadge({ mode }: { mode: OverviewConnectionMode }) {
  if (mode === 'connecting') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Connecting…
      </Badge>
    );
  }

  if (mode === 'live') {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      >
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-muted-foreground">
      Polling
    </Badge>
  );
}

function buildComplianceSeverityMap(
  alerts: ComplianceAlert[]
): Map<string, ComplianceAlert['severity']> {
  const map = new Map<string, ComplianceAlert['severity']>();
  for (const alert of alerts) {
    const existing = map.get(alert.userId);
    if (!existing || (existing === 'warning' && alert.severity === 'critical')) {
      map.set(alert.userId, alert.severity);
    }
  }
  return map;
}

export function AdminOverviewDashboard() {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<FloorStatusFilter>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; code?: string | null } | null>(null);

  const applyOverview = useCallback((data: AdminOverviewResponse) => {
    setOverview(data);
    setLastUpdated(new Date());
    setIsLoading(false);
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const data = await api.get<AdminOverviewResponse>('/api/admin/overview');
      applyOverview(data);
    } catch (err) {
      setToast({
        message: err instanceof ApiError ? err.message : 'Failed to load floor monitor',
        code: err instanceof ApiError ? err.code : undefined,
      });
    } finally {
      setIsLoading(false);
    }
  }, [applyOverview]);

  const { connectionMode } = useOverviewStream({
    onOverview: applyOverview,
    onPoll: loadOverview,
  });

  const complianceSeverityByUserId = useMemo(
    () => buildComplianceSeverityMap(overview?.complianceAlerts ?? []),
    [overview?.complianceAlerts]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Organization
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Floor Monitor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time agent status for call-center operations
              {lastUpdated ? ` · Updated ${lastUpdated.toLocaleTimeString()}` : ''}
            </p>
          </div>
          <ConnectionBadge mode={connectionMode} />
        </div>
      </header>

      <div className="shrink-0 border-b border-border bg-background px-6 py-4">
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
            complianceSeverityByUserId={complianceSeverityByUserId}
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
