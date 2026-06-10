export function formatElapsed(isoStart: string): string {
  const start = new Date(isoStart).getTime();
  const diff = Math.max(0, Date.now() - start);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

export function formatShiftStarted(isoStart: string): string {
  return new Date(isoStart).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
