export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

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

export type RangeDraft = { from: Date; to?: Date };

export type RangeClickResult =
  | { kind: 'draft'; draft: RangeDraft | undefined }
  | { kind: 'apply'; start: Date; end: Date };

/**
 * One step of two-click range building for the date pickers.
 *
 * react-day-picker v10 emits a complete range ({from:D, to:D}) on the very
 * first day click of an empty selection, so an onSelect handler cannot tell
 * "user picked the start" from "range finished". This drives the interaction
 * instead: first click drafts a start and keeps the picker open, second click
 * applies the range (same-day double-click = single-day range), any click
 * while a complete range is drafted starts over.
 */
export function nextRangeDraft(
  draft: RangeDraft | undefined,
  clicked: Date | undefined
): RangeClickResult {
  if (!clicked) return { kind: 'draft', draft: undefined };
  if (!draft?.from || draft.to !== undefined) {
    return { kind: 'draft', draft: { from: clicked } };
  }
  const from = draft.from;
  if (clicked.getTime() === from.getTime()) {
    return { kind: 'apply', start: from, end: from };
  }
  return clicked < from
    ? { kind: 'apply', start: clicked, end: from }
    : { kind: 'apply', start: from, end: clicked };
}
