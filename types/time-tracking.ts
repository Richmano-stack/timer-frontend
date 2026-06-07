export interface TimeLog {
  id: string;
  userId: string;
  companyId: string;
  clockIn: string;
  clockOut: string | null;
  netWorkMinutes: number | null;
  clockInIp: string | null;
  clockOutIp: string | null;
  latitude: string | null;
  longitude: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  timeLogId: string;
  statusId: string;
  statusName: string;
  isProductive: boolean;
  startTime: string;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  timeLog: TimeLog;
  activeActivity: ActivityLog | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface TimeLogResponse {
  timeLog: TimeLog;
}

export interface ActivityStatusOption {
  id: string;
  name: string;
  isProductive: boolean;
}

export interface MyDayShiftRow {
  timeLogId: string;
  clockIn: string;
  clockOut: string | null;
  clockInFormatted: string;
  clockOutFormatted: string;
  status: 'active' | 'closed';
  breakDeductions: string;
  netWorkHours: string;
  notes: string;
}

export interface MyDayActivityRow {
  id: string;
  timeLogId: string;
  shiftClockInFormatted: string;
  statusName: string;
  startTime: string;
  endTime: string | null;
  startFormatted: string;
  endFormatted: string;
  duration: string;
}

export interface MyDayTimelineEvent {
  id: string;
  time: string;
  timeFormatted: string;
  label: string;
  duration: string;
  isProductive: boolean | null;
  kind: 'shift_start' | 'shift_end' | 'status';
}

export interface MyDaySummary {
  gross: string;
  breaks: string;
  net: string;
}

export interface MyDayResponse {
  employeeName: string;
  date: string;
  activeSession: ActiveSession | null;
  activityStatuses: ActivityStatusOption[];
  shifts: MyDayShiftRow[];
  activities: MyDayActivityRow[];
  timeline: MyDayTimelineEvent[];
  summary: MyDaySummary;
}

export interface SetStatusResponse {
  activityLog: ActivityLog | null;
}
