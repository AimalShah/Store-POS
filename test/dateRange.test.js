import { buildDateRange, previousRange } from '../src/lib/dateRange';

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
