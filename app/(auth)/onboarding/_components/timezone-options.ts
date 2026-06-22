export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

export function getIanaTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') {
    return Intl.supportedValuesOf('timeZone').slice().sort();
  }

  return [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];
}

export function formatTimezoneLabel(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    });
    const offset =
      formatter.formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ??
      '';
    const label = timezone.replace(/_/g, ' ');
    return offset ? `${label} (${offset})` : label;
  } catch {
    return timezone.replace(/_/g, ' ');
  }
}
