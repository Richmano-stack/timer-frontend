const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates an IANA timezone identifier and falls back to UTC when invalid.
 */
export function resolveOrganizationTimezone(timezone: string | null | undefined): string {
  if (typeof timezone !== 'string') return 'UTC';

  const trimmed = timezone.trim();
  if (!trimmed) return 'UTC';

  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return 'UTC';
  }
}

function parseLocalDateString(localDateString: string): { year: number; month: number; day: number } {
  if (!LOCAL_DATE_PATTERN.test(localDateString)) {
    throw new Error(`Invalid local date string: ${localDateString}`);
  }

  const [year, month, day] = localDateString.split('-').map(Number);
  return { year, month, day };
}

function addDaysToLocalDateString(localDateString: string, days: number): string {
  const { year, month, day } = parseLocalDateString(localDateString);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function getTimezoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(instant).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  const hour = Number(parts.hour === '24' ? '0' : parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - instant.getTime();
}

function zonedLocalTimeToUtc(
  localDateString: string,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
): Date {
  const { year, month, day } = parseLocalDateString(localDateString);
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = getTimezoneOffsetMs(new Date(utcMs), timeZone);
    utcMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond) - offset;
  }

  return new Date(utcMs);
}

/**
 * Returns UTC instants for the start and end of a calendar day in the organization's timezone.
 */
export function getOrganizationDayRange(
  ianaTimezone: string,
  localDateString: string
): { rangeStart: Date; rangeEnd: Date } {
  const timeZone = resolveOrganizationTimezone(ianaTimezone);
  const rangeStart = zonedLocalTimeToUtc(localDateString, 0, 0, 0, 0, timeZone);
  const nextDay = addDaysToLocalDateString(localDateString, 1);
  const nextDayStart = zonedLocalTimeToUtc(nextDay, 0, 0, 0, 0, timeZone);
  const rangeEnd = new Date(nextDayStart.getTime() - 1);

  return { rangeStart, rangeEnd };
}

/**
 * Returns UTC instants spanning inclusive local start/end calendar days in the organization's timezone.
 */
export function getOrganizationDateRange(
  ianaTimezone: string,
  startDate: string,
  endDate: string
): { rangeStart: Date; rangeEnd: Date } {
  const start = getOrganizationDayRange(ianaTimezone, startDate);
  const end = getOrganizationDayRange(ianaTimezone, endDate);

  return {
    rangeStart: start.rangeStart,
    rangeEnd: end.rangeEnd,
  };
}

/**
 * Formats an instant as YYYY-MM-DD in the organization's timezone.
 */
export function getOrganizationLocalDateString(instant: Date, ianaTimezone: string): string {
  const timeZone = resolveOrganizationTimezone(ianaTimezone);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Returns today's calendar date (YYYY-MM-DD) in the organization's timezone.
 */
export function getOrganizationTodayDateString(ianaTimezone: string, now = new Date()): string {
  return getOrganizationLocalDateString(now, ianaTimezone);
}
