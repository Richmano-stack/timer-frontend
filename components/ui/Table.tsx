import { ReactNode } from 'react';

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function TableSectionTitle({
  title,
  caption,
}: {
  title: string;
  caption?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-sage/70">{title}</h2>
      {caption && <p className="text-xs text-sage/50">{caption}</p>}
    </div>
  );
}

export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-mist bg-white',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Table({
  children,
  className,
  minWidth,
}: {
  children: ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn('w-full text-left text-sm', className)}
        style={minWidth ? { minWidth } : undefined}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-sage text-ice">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-semibold uppercase tracking-widest',
        className
      )}
    >
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        'border-b border-mist last:border-0 hover:bg-mint/60',
        className
      )}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={cn('px-4 py-3 text-sage', className)} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function TableEmptyState({ message }: { message: string }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={99} className="py-10 text-center text-sm text-sage/60">
        {message}
      </TableCell>
    </TableRow>
  );
}
