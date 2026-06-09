const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const today = new Date().toISOString().slice(0, 10);

export interface SandboxPreset {
  label: string;
  payload: string;
}

export interface SandboxEndpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  dbNote: string;
  usesQueryParams: boolean;
  defaultPayload: string;
  presets: SandboxPreset[];
}

export const SANDBOX_ENDPOINTS: SandboxEndpoint[] = [
  {
    id: 'my-day',
    method: 'GET',
    path: '/api/time/my-day',
    title: 'My Day',
    description:
      'Load today timeline, summary, and active session. Requires session cookie and active organization.',
    dbNote: 'Read-only: User, TimeLog, ActivityStatus',
    usesQueryParams: true,
    defaultPayload: pretty({ date: today }),
    presets: [
      { label: 'Today', payload: pretty({ date: today }) },
      { label: 'No date (server default)', payload: pretty({}) },
    ],
  },
  {
    id: 'clock-in',
    method: 'POST',
    path: '/api/time/clock-in',
    title: 'Clock In',
    description: 'Start shift with org default Available status.',
    dbNote: 'Creates open TimeLog segment',
    usesQueryParams: false,
    defaultPayload: pretty({}),
    presets: [
      { label: 'Clock in', payload: pretty({}) },
      { label: 'With notes', payload: pretty({ notes: 'Starting morning shift' }) },
    ],
  },
  {
    id: 'clock-out',
    method: 'POST',
    path: '/api/time/clock-out',
    title: 'Clock Out',
    description: 'Close the open TimeLog segment and end shift.',
    dbNote: 'Sets endTime on open segment',
    usesQueryParams: false,
    defaultPayload: pretty({}),
    presets: [{ label: 'Clock out', payload: pretty({}) }],
  },
  {
    id: 'set-status',
    method: 'POST',
    path: '/api/time/status',
    title: 'Set Status',
    description: 'Close current segment and open a new one. Empty body sets Available.',
    dbNote: 'Closes open TimeLog + creates new TimeLog row',
    usesQueryParams: false,
    defaultPayload: pretty({}),
    presets: [
      { label: 'Set Available', payload: pretty({}) },
      { label: 'Set status by id', payload: pretty({ statusId: 'uuid-from-my-day-response' }) },
    ],
  },
  {
    id: 'admin-overview',
    method: 'GET',
    path: '/api/admin/overview',
    title: 'Admin Overview',
    description: 'Floor monitor KPIs and live agent statuses (owner/admin role).',
    dbNote: 'Read-only aggregate queries',
    usesQueryParams: true,
    defaultPayload: pretty({}),
    presets: [{ label: 'Overview', payload: pretty({}) }],
  },
  {
    id: 'admin-timesheets',
    method: 'GET',
    path: '/api/admin/timesheets',
    title: 'Admin Timesheets',
    description: 'Timesheet rows for a date range (owner/admin role).',
    dbNote: 'Read-only TimeLog aggregation',
    usesQueryParams: true,
    defaultPayload: pretty({ startDate: today, endDate: today }),
    presets: [
      {
        label: 'Today',
        payload: pretty({ startDate: today, endDate: today }),
      },
    ],
  },
];

export function getMethodBadgeClass(method: SandboxEndpoint['method']): string {
  if (method === 'GET') return 'bg-sky-500/15 text-sky-300 ring-sky-500/30';
  return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30';
}

export function getStatusTone(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-400';
  if (status >= 400 && status < 500) return 'text-amber-400';
  if (status >= 500) return 'text-rose-400';
  return 'text-slate-300';
}
