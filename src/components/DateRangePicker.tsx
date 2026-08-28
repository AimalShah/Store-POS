import { useEffect, useState } from 'react';
import { type DateRange as RdpRange } from 'react-day-picker';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { useLocale } from '@/i18n/LocaleContext';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  buildDateRange,
  nextRangeDraft,
  type DateRange,
  type RangeDraft,
  type RangePreset,
} from '@/lib/dateRange';

export type PickerValue = { preset: RangePreset | 'custom'; range: DateRange };

const PRESETS: { value: RangePreset }[] = [
  { value: 'today' },
  { value: '7d' },
  { value: '30d' },
  { value: '90d' },
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
  const [draft, setDraft] = useState<RangeDraft | undefined>(undefined);
  const { t } = useLocale();

  useEffect(() => {
    if (!open) setDraft(undefined);
  }, [open]);

  const rdp: RdpRange | undefined = value.preset === 'custom'
    ? { from: new Date(value.range.start), to: new Date(value.range.end) }
    : undefined;
  const selected: RdpRange | undefined = draft ?? rdp;

  const label =
    value.preset === 'custom'
      ? formatCustom(value.range)
      : t(`daterange.${value.preset}`);

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
                {t(`daterange.${p.value}`)}
              </button>
            ))}
          </div>
          <Separator orientation="vertical" className="my-2" />
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={selected}
            onSelect={(_range, triggerDate) => {
              const result = nextRangeDraft(draft, triggerDate ?? undefined);
              if (result.kind === 'draft') {
                setDraft(result.draft);
                return;
              }
              const start = new Date(result.start);
              start.setUTCHours(0, 0, 0, 0);
              const end = new Date(result.end);
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
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
