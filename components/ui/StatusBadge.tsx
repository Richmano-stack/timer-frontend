import { cn } from '@/lib/utils';

export function StatusBadge({
  label,
  status,
}: {
  label: string;
  status?: 'working' | 'on_break';
}) {
  const isWorking = status === 'working' || label === 'Working' || label === 'Available';

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        isWorking
          ? 'bg-brand-accent/10 text-indigo-600 ring-brand-accent/30 dark:text-indigo-400'
          : 'bg-background text-muted-foreground ring-border'
      )}
    >
      {label}
    </span>
  );
}
