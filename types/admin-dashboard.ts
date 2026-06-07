export interface AdminKpis {
  activeShiftCount: number;
  onBreakCount: number;
  availableCount: number;
  offFloorCount: number;
  totalRegistered: number;
}

export interface StatusBreakdownItem {
  name: string;
  count: number;
  isProductive: boolean;
}

export interface FloorAgentRow {
  userId: string;
  employeeName: string;
  timeLogId: string | null;
  clockIn: string | null;
  displayStatus: string;
  isProductive: boolean | null;
  statusSince: string | null;
  breakToday: string;
  isOnShift: boolean;
}

export interface ComplianceAlert {
  userId: string;
  employeeName: string;
  timeLogId: string;
  clockIn: string;
  elapsedHours: number;
  message: string;
  severity: 'warning' | 'critical';
}

export interface AdminOverviewResponse {
  kpis: AdminKpis;
  statusBreakdown: StatusBreakdownItem[];
  floorAgents: FloorAgentRow[];
  complianceAlerts: ComplianceAlert[];
}

export interface TimesheetRow {
  timeLogId: string;
  userId: string;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  clockInFormatted: string;
  clockOutFormatted: string;
  breakDeductions: string;
  netWorkHours: string;
}

export interface TimesheetsResponse {
  rows: TimesheetRow[];
}

export type FloorStatusFilter =
  | 'all'
  | 'available'
  | 'productive'
  | 'break'
  | 'off_floor';
