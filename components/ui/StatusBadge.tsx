export function StatusBadge({
  label,
  status,
}: {
  label: string;
  status?: 'working' | 'on_break';
}) {
  const isWorking = status === 'working' || label === 'Working';

  const classes = isWorking
    ? 'bg-mint text-sage ring-mist'
    : 'bg-mauve/15 text-sage ring-mauve/30';

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${classes}`}
    >
      {label}
    </span>
  );
}
