'use client';

import { format } from 'date-fns';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
  fromDate,
  toDate,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
}) {
  const selected = parseIsoDate(value);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Popover modal>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          render={
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                'w-[200px] justify-between font-normal',
                !selected && 'text-muted-foreground'
              )}
            />
          }
        >
          <span className="flex items-center gap-2">
            <CalendarIcon />
            {selected ? format(selected, 'PPP') : placeholder}
          </span>
          <ChevronDownIcon />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) onChange(toIsoDateString(date));
            }}
            defaultMonth={selected}
            disabled={
              fromDate || toDate
                ? [
                    ...(fromDate ? [{ before: fromDate }] : []),
                    ...(toDate ? [{ after: toDate }] : []),
                  ]
                : undefined
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
