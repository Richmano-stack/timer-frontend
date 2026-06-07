import { FloorAgentRow, FloorStatusFilter } from '@/types/admin-dashboard';

export function matchesFloorFilter(agent: FloorAgentRow, filter: FloorStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'off_floor') return !agent.isOnShift;
  if (filter === 'available') return agent.isOnShift && agent.displayStatus === 'Available';
  if (filter === 'break') return agent.isOnShift && agent.isProductive === false;
  if (filter === 'productive') {
    return agent.isOnShift && agent.displayStatus !== 'Available' && agent.isProductive === true;
  }
  return true;
}

export const FLOOR_FILTER_OPTIONS: { id: FloorStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'productive', label: 'On Channel' },
  { id: 'break', label: 'On Break' },
  { id: 'off_floor', label: 'Off Floor' },
];
