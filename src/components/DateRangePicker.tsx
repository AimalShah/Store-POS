import { useState } from 'react';
import { type DateRange as RdpRange } from 'react-day-picker';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { buildDateRange, type DateRange, type RangePreset } from '@/lib/dateRange';

export type PickerValue = { preset: RangePreset | 'custom'; range: DateRange };

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

function formatCustom(range: DateRange): string {
  const from = new Date(range.start);
  const to = new Date(range.end);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (from.toDateString() === to.toDateString()) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function DateRangePicker({
  value,
  onChange,
  className,
}: {
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rdp: RdpRange | undefined = value.preset === 'custom'
    ? { from: new Date(value.range.start), to: new Date(value.range.end) }
    : undefined;

  const label =
    value.preset === 'custom' ? formatCustom(value.range) : PRESETS.find((p) => p.value === value.preset)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted',
          className
        )}
      >
        <CalendarRange className="size-4" />
        <span className="text-foreground">{label}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col gap-1 p-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => {
                  onChange({ preset: p.value, range: buildDateRange(p.value) });
                  setOpen(false);
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  value.preset === p.value && 'bg-accent font-medium text-accent-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="my-2" />
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={rdp}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                const start = new Date(range.from);
                start.setUTCHours(0, 0, 0, 0);
                const end = new Date(range.to);
                end.setUTCHours(23, 59, 59, 999);
                onChange({
                  preset: 'custom',
                  range: {
                    preset: 'custom',
                    start: start.toISOString(),
                    end: end.toISOString(),
                  },
                });
                setOpen(false);
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
