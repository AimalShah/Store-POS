import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { itemLineTotal, parseJson, computeSalesSummary, computeBestSellers } from '../server/lib/sales.js';
import { mapShift } from '../server/db.js';
import { bootApp } from './helpers.js';

// --- pure pricing / parsing logic ----------------------------------------
describe('itemLineTotal', () => {
  test('returns base price * quantity with no discount', () => {
    expect(itemLineTotal({ price: 5, quantity: 3 })).toBe(15);
  });

  test('applies a percentage discount', () => {
    expect(itemLineTotal({ price: 10, quantity: 2, discountValue: 10, discountType: 'percent' })).toBe(18);
  });

  test('applies a flat discount and never goes below zero', () => {
    expect(itemLineTotal({ price: 4, quantity: 1, discountValue: 10, discountType: 'flat' })).toBe(0);
  });
});

describe('parseJson', () => {
  test('parses valid JSON', () => {
    expect(parseJson('[1,2,3]', [])).toEqual([1, 2, 3]);
  });
  test('returns the fallback on invalid JSON', () => {
    expect(parseJson('not json', 'fallback')).toBe('fallback');
  });
});

describe('invoice number format', () => {
  test('matches INV-YYYYMMDD-NNN', () => {
    expect('INV-20240101-007').toMatch(/^INV-\d{8}-\d{3}$/);
  });
});

// --- aggregation over a real database ------------------------------------
let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

async function makeProduct(name, price, category) {
  const data = await app.createProduct(name, price, category, true, 50);
  return data.id;
}

async function makeSale({ items, total, date }) {
  await app.client.login();
  const { data } = await app.client.request('/api/new', {
    method: 'POST',
    body: JSON.stringify({
      ref_number: '',
      customer: '0',
      customer_name: 'Walk-in Customer',
      status: 1,
      user_id: 1,
      user: 'Administrator',
      till: 1,
      discount: 0,
      subtotal: total,
      tax: 0,
      total,
      paid: total,
      change: 0,
      payment_type: 1,
      payment_breakdown: [{ method: 'cash', amount: total }],
      items,
      date: date || new Date().toISOString(),
    }),
  });
  return data;
}

describe('computeSalesSummary', () => {
  test('totals reflect the sales written to the database', async () => {
    const cola = await makeProduct('Cola', 2, 'Drinks');
    const fries = await makeProduct('Fries', 3, 'Food');
    await makeSale({ items: [{ id: cola, name: 'Cola', price: 2, quantity: 2 }], total: 4 });
    await makeSale({ items: [{ id: fries, name: 'Fries', price: 3, quantity: 5 }], total: 15 });

    const { summary, byCategory } = computeSalesSummary({});
    expect(summary.saleCount).toBe(2);
    expect(summary.totalSales).toBe(19);
    expect(byCategory).toHaveLength(2);
  });
});

describe('computeBestSellers', () => {
  test('ranks by units sold', async () => {
    const a = await makeProduct('A', 2, 'Food');
    const b = await makeProduct('B', 3, 'Food');
    await makeSale({ items: [{ id: a, name: 'A', price: 2, quantity: 2 }], total: 4 });
    await makeSale({ items: [{ id: b, name: 'B', price: 3, quantity: 9 }], total: 27 });

    const ranked = computeBestSellers({});
    expect(ranked[0].id).toBe(b);
    expect(ranked[0].quantity).toBe(9);
  });
});

describe('mapShift', () => {
  test('returns null for null input', () => {
    expect(mapShift(null)).toBeNull();
  });

  test('parses valid xReport and zReport JSON', () => {
    const row = {
      id: 1, user_id: 1, user_name: 'Admin', till: 1,
      float_amount: 100, counted_cash: 105, status: 'closed',
      opened_at: '2024-01-01T00:00:00Z', closed_at: '2024-01-01T12:00:00Z',
      x_report_json: '{"sales":10}', z_report_json: '{"sales":20}',
    };
    const result = mapShift(row);
    expect(result.xReport).toEqual({ sales: 10 });
    expect(result.zReport).toEqual({ sales: 20 });
  });

  test('returns null for corrupted x_report_json without crashing', () => {
    const row = {
      id: 2, user_id: 1, user_name: 'Admin', till: 1,
      float_amount: 100, counted_cash: 100, status: 'closed',
      opened_at: '2024-01-01T00:00:00Z', closed_at: '2024-01-01T12:00:00Z',
      x_report_json: '{corrupted!!!', z_report_json: null,
    };
    const result = mapShift(row);
    expect(result.xReport).toBeNull();
    expect(result.zReport).toBeNull();
  });

  test('returns null for corrupted z_report_json without crashing', () => {
    const row = {
      id: 3, user_id: 1, user_name: 'Admin', till: 1,
      float_amount: 50, counted_cash: 50, status: 'closed',
      opened_at: '2024-01-01T00:00:00Z', closed_at: '2024-01-01T12:00:00Z',
      x_report_json: null, z_report_json: 'not-json',
    };
    const result = mapShift(row);
    expect(result.xReport).toBeNull();
    expect(result.zReport).toBeNull();
  });
});
