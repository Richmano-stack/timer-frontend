import { StatusType } from '@prisma/client';

export interface TimeLogSegment {
  id: string;
  userId: string;
  organizationId: string;
  activityStatusId: string;
  statusName: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
  isProductive: boolean;
  startTime: string;
  endTime: string | null;
  notes: string | null;
}

export interface ActiveSession {
  activeSegment: TimeLogSegment | null;
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
  segment: TimeLogSegment;
}

export interface ActivityStatusOption {
  id: string;
  name: string;
  type: StatusType;
  colorCode: string;
  isBillable: boolean;
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
  segment: TimeLogSegment | null;
}
