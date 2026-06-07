export const DEV_USER_ID =
  process.env.NEXT_PUBLIC_DEV_USER_ID ?? '00000000-0000-4000-8000-000000000001';

export const DEV_COMPANY_ID =
  process.env.NEXT_PUBLIC_DEV_COMPANY_ID ?? '00000000-0000-4000-8000-000000000010';

export const DEV_STATUS_LUNCH_ID = '00000000-0000-4000-8000-000000000101';
export const DEV_STATUS_SHORT_BREAK_ID = '00000000-0000-4000-8000-000000000102';
export const DEV_STATUS_MEETING_ID = '00000000-0000-4000-8000-000000000103';
export const DEV_STATUS_ON_CALL_ID = '00000000-0000-4000-8000-000000000104';
export const DEV_STATUS_LIVE_CHAT_ID = '00000000-0000-4000-8000-000000000105';
export const DEV_STATUS_ACW_ID = '00000000-0000-4000-8000-000000000106';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SandboxPreset {
  label: string;
  payload: string;
}

export interface SandboxEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  dbNote: string;
  usesQueryParams?: boolean;
  defaultPayload: string;
  presets: SandboxPreset[];
}

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

export const SANDBOX_ENDPOINTS: SandboxEndpoint[] = [
  {
    id: 'my-day',
    method: 'GET',
    path: '/api/time/my-day',
    title: 'Get My Day',
    description:
      'Employee dashboard payload: active session, today\'s shifts and activities, and company activity statuses.',
    dbNote: 'Read-only: User, TimeLog, ActivityLog, ActivityStatus',
    usesQueryParams: true,
    defaultPayload: pretty({
      userId: DEV_USER_ID,
      companyId: DEV_COMPANY_ID,
      date: '2026-06-06',
    }),
    presets: [
      {
        label: 'Valid Payload Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
        }),
      },
      {
        label: 'Specific Date Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
          date: '2026-06-06',
        }),
      },
      {
        label: 'Malformed/Invalid Data Preset',
        payload: pretty({ userId: 'not-a-uuid', companyId: DEV_COMPANY_ID }),
      },
    ],
  },
  {
    id: 'clock-in',
    method: 'POST',
    path: '/api/time/clock-in',
    title: 'Clock In',
    description:
      'Starts a new work session. Rejects with USER_ALREADY_CLOCKED_IN if an open session exists.',
    dbNote: 'Creates row in TimeLog',
    defaultPayload: pretty({
      userId: DEV_USER_ID,
      companyId: DEV_COMPANY_ID,
      clockInIp: '127.0.0.1',
      latitude: 40.7128,
      longitude: -74.006,
      notes: 'Sandbox clock-in',
    }),
    presets: [
      {
        label: 'Valid Payload Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
          notes: 'Valid sandbox session',
        }),
      },
      {
        label: 'Malformed/Invalid Data Preset',
        payload: pretty({
          userId: 'invalid',
          companyId: DEV_COMPANY_ID,
        }),
      },
      {
        label: 'Minimal Payload Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
        }),
      },
    ],
  },
  {
    id: 'set-status',
    method: 'POST',
    path: '/api/time/status',
    title: 'Set Status',
    description:
      'Atomically switches agent status on an open shift. Omit statusId/statusName to return to Available.',
    dbNote: 'Updates open ActivityLog + creates new ActivityLog row',
    defaultPayload: pretty({
      userId: DEV_USER_ID,
      companyId: DEV_COMPANY_ID,
      statusId: DEV_STATUS_ON_CALL_ID,
    }),
    presets: [
      {
        label: 'Available Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
        }),
      },
      {
        label: 'On Call Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
          statusId: DEV_STATUS_ON_CALL_ID,
        }),
      },
      {
        label: 'Live Chat Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
          statusName: 'Live Chat',
        }),
      },
    ],
  },
  {
    id: 'clock-out',
    method: 'POST',
    path: '/api/time/clock-out',
    title: 'Clock Out',
    description:
      'Closes the active session and atomically ends any open breaks on that TimeLog.',
    dbNote: 'Updates TimeLog + open ActivityLog rows',
    defaultPayload: pretty({
      userId: DEV_USER_ID,
      companyId: DEV_COMPANY_ID,
      clockOutIp: '127.0.0.1',
    }),
    presets: [
      {
        label: 'Valid Payload Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: DEV_COMPANY_ID,
        }),
      },
      {
        label: 'Malformed/Invalid Data Preset',
        payload: pretty({
          userId: DEV_USER_ID,
          companyId: 'bad-company-id',
        }),
      },
      {
        label: 'No Active Session Preset',
        payload: pretty({
          userId: '00000000-0000-4000-8000-000000009999',
          companyId: DEV_COMPANY_ID,
        }),
      },
    ],
  },
];

export function getMethodBadgeClass(method: HttpMethod): string {
  switch (method) {
    case 'GET':
      return 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30';
    case 'POST':
      return 'bg-amber-500/15 text-amber-400 ring-amber-500/30';
    case 'PUT':
    case 'PATCH':
      return 'bg-sky-500/15 text-sky-400 ring-sky-500/30';
    case 'DELETE':
      return 'bg-rose-500/15 text-rose-400 ring-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-400 ring-slate-500/30';
  }
}

export function getStatusTone(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-400';
  if (status >= 400 && status < 500) return 'text-amber-400';
  if (status >= 500) return 'text-rose-400';
  return 'text-slate-300';
}
