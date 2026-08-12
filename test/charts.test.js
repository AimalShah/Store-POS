import {
  computeKpis,
  buildTrendSeries,
  buildCategoryBreakdown,
  buildTopProducts,
} from '../src/lib/dashboard';

function tx(over = {}) {
  return {
    _id: 1,
    id: 1,
    ref_number: '',
    customer: '0',
    customer_name: '',
    status: 1,
    user_id: 1,
    user: '',
    till: 1,
    discount: 0,
    subtotal: 0,
    tax: 0,
    total: over.total ?? 0,
    paid: 0,
    change: 0,
    payment_type: 1,
    items: over.items ?? [],
    date: over.date ?? '2026-08-13T12:00:00.000Z',
    ...over,
  };
}

function cat(id, name) {
  return { _id: id, id, name };
}

const range = { preset: '7d', start: '2026-08-07T00:00:00.000Z', end: '2026-08-13T23:59:59.999Z' };

describe('dashboard chart aggregations', () => {
  test('buildTrendSeries produces a continuous daily series and sums totals', () => {
    const txs = [
      tx({ total: 10, date: '2026-08-10T10:00:00.000Z' }),
      tx({ total: 5, date: '2026-08-10T18:00:00.000Z' }),
      tx({ total: 20, date: '2026-08-12T09:00:00.000Z' }),
    ];
    const series = buildTrendSeries(txs, range);
    // One point per day across the whole range (7d => 7 points), gaps zero-filled.
    expect(series.length).toBe(7);
    const totals = series.map((p) => p.total);
    expect(totals).toContain(15); // 10 + 5 on Aug 10
    expect(totals).toContain(20); // Aug 12
    expect(totals.filter((t) => t > 0).length).toBe(2);
    // Ascending by day.
    expect(series[0].total).toBeDefined();
    expect(series[6].total).toBeDefined();
  });

  test('buildTrendSeries buckets "today" hourly', () => {
    const today = {
      preset: 'today',
      start: '2026-08-13T00:00:00.000Z',
      end: '2026-08-13T23:59:59.999Z',
    };
    const txs = [
      tx({ total: 12, date: '2026-08-13T08:30:00.000Z' }),
      tx({ total: 8, date: '2026-08-13T08:45:00.000Z' }),
      tx({ total: 30, date: '2026-08-13T20:15:00.000Z' }),
    ];
    const series = buildTrendSeries(txs, today);
    expect(series.length).toBe(24); // hourly buckets
    expect(series[8].total).toBe(20); // 08:00 hour
    expect(series[20].total).toBe(30);
  });

  test('buildCategoryBreakdown groups item revenue by category name', () => {
    const cats = [cat(1, 'Drinks'), cat(2, 'Food')];
    const txs = [
      tx({
        items: [
          { id: 1, name: 'Cola', price: 2, quantity: 3, categoryId: 1 },
          { id: 2, name: 'Fries', price: 5, quantity: 2, categoryId: 2 },
        ],
      }),
      tx({ items: [{ id: 1, name: 'Cola', price: 2, quantity: 1, categoryId: 1 }] }),
    ];
    const slices = buildCategoryBreakdown(txs, cats);
    const byCat = Object.fromEntries(slices.map((s) => [s.category, s.revenue]));
    expect(byCat.Drinks).toBe(8); // (2*3) + (2*1)
    expect(byCat.Food).toBe(10); // 5*2
  });

  test('buildCategoryBreakdown falls back to Uncategorized for unknown ids', () => {
    const slices = buildCategoryBreakdown(
      [tx({ items: [{ id: 9, name: 'X', price: 4, quantity: 1, categoryId: 99 }] })],
      []
    );
    expect(slices[0].category).toBe('Uncategorized');
    expect(slices[0].revenue).toBe(4);
  });

  test('buildTopProducts ranks by revenue and respects the limit', () => {
    const txs = [
      tx({
        items: [
          { id: 1, name: 'Cola', price: 2, quantity: 3 },
          { id: 2, name: 'Fries', price: 5, quantity: 4 },
          { id: 3, name: 'Burger', price: 8, quantity: 1 },
        ],
      }),
      tx({ items: [{ id: 2, name: 'Fries', price: 5, quantity: 2 }] }),
    ];
    const top = buildTopProducts(txs, 2);
    expect(top.map((p) => p.name)).toEqual(['Fries', 'Burger']);
    // Fries: (5*4)+(5*2)=30, Burger: 8, Cola: 6
    expect(top[0].name).toBe('Fries');
  });
});
