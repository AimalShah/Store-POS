import { buildDateRange, previousRange, nextRangeDraft } from '../src/lib/dateRange';

function dayStart(d) {
  return d.slice(0, 10);
}

describe('buildDateRange', () => {
  const now = new Date('2026-08-13T15:04:00.000Z');

  test('today spans a single calendar day from 00:00 to 23:59', () => {
    const r = buildDateRange('today', now);
    expect(dayStart(r.start)).toBe('2026-08-13');
    expect(new Date(r.start).getUTCHours()).toBe(0);
    expect(dayStart(r.end)).toBe('2026-08-13');
  });

  test('7d covers the last 7 days inclusive', () => {
    const r = buildDateRange('7d', now);
    const days = Math.round(
      (new Date(r.end).getTime() - new Date(r.start).getTime()) / 86400000
    );
    expect(days).toBe(7); // 7 calendar days inclusive (end is 23:59)
    expect(dayStart(r.start)).toBe('2026-08-07');
  });

  test('30d and 90d start the right number of days back', () => {
    const r30 = buildDateRange('30d', now);
    expect(dayStart(r30.start)).toBe('2026-07-15');
    const r90 = buildDateRange('90d', now);
    expect(dayStart(r90.start)).toBe('2026-05-16');
  });

  test('start is never after end', () => {
    for (const p of ['today', '7d', '30d', '90d']) {
      const r = buildDateRange(p, now);
      expect(new Date(r.start).getTime()).toBeLessThanOrEqual(
        new Date(r.end).getTime()
      );
    }
  });

  test('previousRange returns the equal-length period immediately before', () => {
    const today = buildDateRange('today', now);
    const prev = previousRange(today);
    expect(dayStart(prev.start)).toBe('2026-08-12');
    expect(dayStart(prev.end)).toBe('2026-08-12');

    const r7 = buildDateRange('7d', now);
    const prev7 = previousRange(r7);
    expect(dayStart(prev7.end)).toBe('2026-08-06');
    expect(dayStart(prev7.start)).toBe('2026-07-31');
  });
});

describe('nextRangeDraft (two-click range building in the date picker)', () => {
  const A = new Date('2026-08-10T00:00:00.000Z');
  const B = new Date('2026-08-20T00:00:00.000Z');
  const C = new Date('2026-08-05T00:00:00.000Z');

  // Regression: react-day-picker v10 emits {from:D,to:D} on the FIRST click,
  // which used to make the picker apply + close immediately, so a range could
  // never be built across two clicks.
  test('first click starts a draft and keeps the picker open', () => {
    const r = nextRangeDraft(undefined, A);
    expect(r.kind).toBe('draft');
    expect(r.draft.from.getTime()).toBe(A.getTime());
    expect(r.draft.to).toBeUndefined();
  });

  test('second click after the start applies the range and closes', () => {
    const r = nextRangeDraft({ from: A }, B);
    expect(r.kind).toBe('apply');
    expect(r.start.getTime()).toBe(A.getTime());
    expect(r.end.getTime()).toBe(B.getTime());
  });

  test('second click before the start flips so start <= end', () => {
    const r = nextRangeDraft({ from: B }, C);
    expect(r.kind).toBe('apply');
    expect(r.start.getTime()).toBe(C.getTime());
    expect(r.end.getTime()).toBe(B.getTime());
  });

  test('clicking the start day twice applies a single-day range', () => {
    const r = nextRangeDraft({ from: A }, A);
    expect(r.kind).toBe('apply');
    expect(r.start.getTime()).toBe(A.getTime());
    expect(r.end.getTime()).toBe(A.getTime());
  });

  test('a click while a complete range is drafted starts a fresh draft', () => {
    const r = nextRangeDraft({ from: A, to: B }, C);
    expect(r.kind).toBe('draft');
    expect(r.draft.from.getTime()).toBe(C.getTime());
    expect(r.draft.to).toBeUndefined();
  });

  test('a cleared selection (undefined day) resets the draft', () => {
    const r = nextRangeDraft({ from: A }, undefined);
    expect(r.kind).toBe('draft');
    expect(r.draft).toBeUndefined();
  });
});
