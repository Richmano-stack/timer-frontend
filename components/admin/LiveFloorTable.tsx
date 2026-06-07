'use client';

import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableShell,
} from '@/components/ui/Table';
import { FLOOR_FILTER_OPTIONS, matchesFloorFilter } from '@/lib/utils/floor-filters';
import { formatElapsed, formatShiftStarted } from '@/lib/utils/format-time';
import { ComplianceAlert, FloorAgentRow, FloorStatusFilter } from '@/types/admin-dashboard';

function StatusElapsed({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(since));

  useEffect(() => {
    const tick = () => setElapsed(formatElapsed(since));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return <span className="font-mono tabular-nums">{elapsed}</span>;
}

function agentRowClass(agent: FloorAgentRow): string | undefined {
  if (!agent.isOnShift) return 'opacity-70';
  if (agent.isProductive === false) return 'bg-mauve/5 hover:bg-mauve/10';
  if (agent.displayStatus === 'Available') return 'bg-mint/20 hover:bg-mint/30';
  return undefined;
}

function statusBadgeProps(agent: FloorAgentRow): {
  label: string;
  status?: 'working' | 'on_break';
} {
  if (!agent.isOnShift) {
    return { label: 'Clocked Out' };
  }
  if (agent.isProductive === false) {
    return { label: agent.displayStatus, status: 'on_break' };
  }
  return { label: agent.displayStatus, status: 'working' };
}

export function LiveFloorTable({
  agents,
  filter,
  onFilterChange,
  isLoading,
  onSelectAgent,
}: {
  agents: FloorAgentRow[];
  filter: FloorStatusFilter;
  onFilterChange: (filter: FloorStatusFilter) => void;
  isLoading: boolean;
  onSelectAgent: (userId: string) => void;
}) {
  const filteredAgents = agents.filter((agent) => matchesFloorFilter(agent, filter));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-mist px-4 py-3">
        {FLOOR_FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onFilterChange(option.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filter === option.id
                ? 'bg-sage text-ice'
                : 'border border-mist bg-white text-sage hover:bg-mint/40'
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-sage/50">
          {filteredAgents.length} agent{filteredAgents.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <TableShell>
            <Table>
              <TableHead>
                <TableHeaderCell>Employee</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>In Status</TableHeaderCell>
                <TableHeaderCell>Shift Started</TableHeaderCell>
                <TableHeaderCell>Break Today</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableHead>
              <TableBody>
                {filteredAgents.length > 0 ? (
                  filteredAgents.map((agent) => (
                    <TableRow key={agent.userId} className={agentRowClass(agent)}>
                      <TableCell className="font-medium">{agent.employeeName}</TableCell>
                      <TableCell>
                        <StatusBadge {...statusBadgeProps(agent)} />
                      </TableCell>
                      <TableCell>
                        {agent.statusSince ? (
                          <StatusElapsed since={agent.statusSince} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {agent.clockIn ? formatShiftStarted(agent.clockIn) : '—'}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{agent.breakToday}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onSelectAgent(agent.userId)}
                          className="text-xs font-semibold text-mauve hover:underline"
                        >
                          Today&apos;s Log
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmptyState message="No agents match this filter." />
                )}
              </TableBody>
            </Table>
          </TableShell>
        )}
      </div>
    </div>
  );
}

export function ExceptionsPanel({
  alerts,
  isLoading,
  onSelectAgent,
}: {
  alerts: ComplianceAlert[];
  isLoading: boolean;
  onSelectAgent: (userId: string) => void;
}) {
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-mist bg-white">
      <div className="border-b border-mist px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-sage/50">
          Exceptions
        </p>
        <p className="mt-1 text-sm text-sage/70">Issues requiring supervisor attention</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-lg border border-mist bg-mint/20 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-sage">All clear</p>
            <p className="mt-1 text-xs text-sage/60">No compliance exceptions right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <button
                key={`${alert.timeLogId}-${alert.message}`}
                type="button"
                onClick={() => onSelectAgent(alert.userId)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition hover:shadow-sm ${
                  alert.severity === 'critical'
                    ? 'border-mauve/40 bg-mauve/10 hover:bg-mauve/15'
                    : 'border-sage/20 bg-mint/30 hover:bg-mint/40'
                }`}
              >
                <p className="font-semibold text-sage">{alert.employeeName}</p>
                <p className="mt-1 text-sm text-sage/80">{alert.message}</p>
                <p className="mt-2 text-xs text-sage/50">
                  Shift since {formatShiftStarted(alert.clockIn)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
