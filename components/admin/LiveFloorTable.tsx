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
import { cn } from '@/lib/utils';
import { ComplianceAlert, FloorAgentRow, FloorStatusFilter } from '@/types/admin-dashboard';

function StatusElapsed({ since, isRunning }: { since: string; isRunning: boolean }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(since));

  useEffect(() => {
    const tick = () => setElapsed(formatElapsed(since));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [since]);

  return (
    <span
      className={cn(
        'font-mono tabular-nums transition-colors duration-300',
        isRunning ? 'timer-running' : 'timer-paused'
      )}
    >
      {elapsed}
    </span>
  );
}

function agentRowClass(agent: FloorAgentRow): string | undefined {
  if (!agent.isOnShift) return 'opacity-60';
  if (agent.isProductive === false) return 'bg-background hover:bg-background/80';
  if (agent.displayStatus === 'Available') return 'bg-brand-accent/5 hover:bg-brand-accent/10';
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
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        {FLOOR_FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onFilterChange(option.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold transition',
              filter === option.id
                ? 'bg-brand-accent text-white'
                : 'border border-border bg-card text-foreground hover:bg-background'
            )}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
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
                          <StatusElapsed
                            since={agent.statusSince}
                            isRunning={agent.isOnShift}
                          />
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
                          className="text-xs font-semibold text-indigo-600 transition hover:underline dark:text-indigo-400"
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
    <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Exceptions
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Issues requiring supervisor attention
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-lg border border-border bg-brand-accent/5 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-foreground">All clear</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No compliance exceptions right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <button
                key={`${alert.timeLogId}-${alert.message}`}
                type="button"
                onClick={() => onSelectAgent(alert.userId)}
                className={cn(
                  'w-full rounded-lg border px-4 py-3 text-left transition hover:shadow-sm',
                  alert.severity === 'critical'
                    ? 'border-border bg-background hover:bg-background/80'
                    : 'border-brand-accent/20 bg-brand-accent/5 hover:bg-brand-accent/10'
                )}
              >
                <p className="font-semibold text-foreground">{alert.employeeName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
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
