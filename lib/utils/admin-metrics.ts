export interface SessionMetrics {
  breakMs: number;
  netMs: number;
  grossMs: number;
}

export function computeSessionMetrics(
  clockInIso: string,
  clockOutIso: string | null,
  breaks: { startTime: string; endTime: string | null }[]
): SessionMetrics {
  const clockIn = new Date(clockInIso).getTime();
  const clockOut = clockOutIso ? new Date(clockOutIso).getTime() : Date.now();
  const grossMs = Math.max(0, clockOut - clockIn);

  let breakMs = 0;
  for (const entry of breaks) {
    const start = new Date(entry.startTime).getTime();
    const end = entry.endTime ? new Date(entry.endTime).getTime() : Date.now();
    breakMs += Math.max(0, end - start);
  }

  const netMs = Math.max(0, grossMs - breakMs);
  return { breakMs, netMs, grossMs };
}

export function formatDurationHours(ms: number): string {
  return (ms / (1000 * 60 * 60)).toFixed(2);
}

export function formatNetWorkMinutes(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

export function formatDurationHuman(ms: number): string {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatTimeLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateLocal(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function toCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTimesheetsCsv(
  rows: {
    date: string;
    employeeName: string;
    clockIn: string;
    clockOut: string;
    breakDeductions: string;
    netWorkHours: string;
  }[]
): string {
  const header = ['Date', 'Employee Name', 'Clock In', 'Clock Out', 'Break Deductions', 'Net Work Hours'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        toCsvValue(row.date),
        toCsvValue(row.employeeName),
        toCsvValue(row.clockIn),
        toCsvValue(row.clockOut),
        toCsvValue(row.breakDeductions),
        toCsvValue(row.netWorkHours),
      ].join(',')
    ),
  ];
  return lines.join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 13);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
