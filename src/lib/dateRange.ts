export type RangePreset = 'today' | '7d' | '30d' | '90d';

export type DateRange = {
  preset: RangePreset;
  start: string;
  end: string;
};

export function buildDateRange(preset: RangePreset, now: Date = new Date()): DateRange {
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(now);
  if (preset === 'today') {
    start.setUTCHours(0, 0, 0, 0);
  } else {
    const days = Number(preset.replace('d', ''));
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);
  }

  return { preset, start: start.toISOString(), end: end.toISOString() };
}

/** The equal-length period immediately preceding `range` (for trend comparisons). */
export function previousRange(range: DateRange): DateRange {
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime();
  const lengthMs = end - start;
  const prevEnd = new Date(start - 1);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);
  return {
    preset: range.preset,
    start: prevStart.toISOString(),
    end: prevEnd.toISOString(),
  };
}
