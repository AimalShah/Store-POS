import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { computeSalesSummary, computeBestSellers } from '../server/lib/sales.js';
import { computeKpis } from '../src/lib/dashboard.ts';
import { bootApp } from './helpers.js';

// ---------------------------------------------------------------------------
// These tests prove the KPIs / reports reflect EXACTLY the underlying sales
// (no hidden manipulation): the aggregates must equal the arithmetic of the
// seeded transactions, refunds and held orders must be excluded, and date /
// till windows must filter correctly.
// ---------------------------------------------------------------------------

let app;

async function createCategory(name) {
  await app.client.request('/api/categories/category', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

async function createProduct(name, price, category) {
  const { data } = await app.client.request('/api/inventory/product', {
    method: 'POST',
    body: (() => {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('price', String(price));
      fd.append('category', category);
      fd.append('quantity', '50');
      fd.append('stock', '1');
      fd.append('cost', '2');
      return fd;
    })(),
  });
  return data.id;
}

async function createSale(body) {
  const res = await app.client.request('/api/new', {
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
      subtotal: 0,
      tax: 0,
      total: 0,
      paid: 0,
      change: 0,
      payment_type: 1,
      payment_breakdown: [{ method: 'cash', amount: 0 }],
      items: [],
      date: new Date().toISOString(),
      ...body,
    }),
  });
  return res.data;
}

function saleLine(id, name, price, qty, categoryId) {
  return { id, name, price, quantity: qty, cost: 2, categoryId };
}

beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('computeSalesSummary — exact aggregation over real sales', () => {
  test('sums paid sales by category, payment method and product', async () => {
    await createCategory('Drinks');
    await createCategory('Food');
    const cola = await createProduct('Cola', 5, 'Drinks');
    const burger = await createProduct('Burger', 10, 'Food');

    await createSale({
      items: [saleLine(cola, 'Cola', 5, 2, cola), saleLine(burger, 'Burger', 10, 1, burger)],
      subtotal: 20,
      tax: 2,
      total: 22,
      paid: 22,
      payment_breakdown: [{ method: 'cash', amount: 22 }],
    });
    await createSale({
      items: [saleLine(cola, 'Cola', 5, 1, cola)],
      subtotal: 5,
      tax: 0.5,
      total: 5.5,
      paid: 5.5,
      payment_breakdown: [{ method: 'card', amount: 5.5 }],
    });

    const { summary, byCategory, byPaymentMethod, bestSellers } = computeSalesSummary({});

    expect(summary.saleCount).toBe(2);
    expect(summary.itemsSold).toBe(4); // Cola x2 + Burger x1 + Cola x1
    expect(summary.subtotal).toBeCloseTo(25);
    expect(summary.discount).toBe(0);
    expect(summary.tax).toBeCloseTo(2.5);
    expect(summary.totalSales).toBeCloseTo(27.5);

    const drinks = byCategory.find((c) => c.category === 'Drinks');
    const food = byCategory.find((c) => c.category === 'Food');
    expect(drinks.count).toBe(3);
    expect(drinks.revenue).toBeCloseTo(15); // 3 x Rs5
    expect(food.count).toBe(1);
    expect(food.revenue).toBeCloseTo(10);

    const cash = byPaymentMethod.find((p) => p.method === 'cash');
    const card = byPaymentMethod.find((p) => p.method === 'card');
    expect(cash.amount).toBeCloseTo(22);
    expect(card.amount).toBeCloseTo(5.5);

    const colaRank = bestSellers.find((b) => b.name === 'Cola');
    const burgerRank = bestSellers.find((b) => b.name === 'Burger');
    expect(colaRank.quantity).toBe(3);
    expect(colaRank.revenue).toBeCloseTo(15);
    expect(burgerRank.quantity).toBe(1);
  });

  test('excludes held orders (status 0) and refunds (status 2)', async () => {
    await createCategory('Drinks');
    const cola = await createProduct('Cola', 5, 'Drinks');

    await createSale({
      items: [saleLine(cola, 'Cola', 5, 2, cola)],
      subtotal: 10,
      total: 10,
      paid: 10,
      payment_breakdown: [{ method: 'cash', amount: 10 }],
    });
    // Held order — must NOT count.
    await createSale({
      status: 0,
      ref_number: 'H-1',
      items: [saleLine(cola, 'Cola', 5, 99, cola)],
      subtotal: 495,
      total: 495,
      paid: 0,
      payment_breakdown: [],
    });
    // Refund — must NOT count in paid totals.
    await createSale({
      status: 2,
      items: [saleLine(cola, 'Cola', 5, 3, cola)],
      subtotal: 15,
      total: 15,
      paid: 15,
      payment_breakdown: [{ method: 'cash', amount: 15 }],
    });

    const { summary, byCategory } = computeSalesSummary({});
    expect(summary.saleCount).toBe(1);
    expect(summary.itemsSold).toBe(2);
    expect(summary.totalSales).toBeCloseTo(10);
    const drinks = byCategory.find((c) => c.category === 'Drinks');
    expect(drinks.count).toBe(2);
  });

  test('respects the date window', async () => {
    await createCategory('Drinks');
    const cola = await createProduct('Cola', 5, 'Drinks');
    const old = new Date('2020-01-01T00:00:00Z').toISOString();
    const recent = new Date().toISOString();

    await createSale({ date: old, items: [saleLine(cola, 'Cola', 5, 2, cola)], subtotal: 10, total: 10, paid: 10, payment_breakdown: [{ method: 'cash', amount: 10 }] });
    await createSale({ date: recent, items: [saleLine(cola, 'Cola', 5, 3, cola)], subtotal: 15, total: 15, paid: 15, payment_breakdown: [{ method: 'cash', amount: 15 }] });

    const outside = computeSalesSummary({ start: new Date('2019-01-01'), end: new Date('2020-06-01') });
    expect(outside.summary.saleCount).toBe(1);
    expect(outside.summary.itemsSold).toBe(2);

    const inside = computeSalesSummary({ start: new Date('2024-01-01'), end: new Date() });
    expect(inside.summary.saleCount).toBe(1);
    expect(inside.summary.itemsSold).toBe(3);
  });
});

describe('computeBestSellers — ranking by units then revenue', () => {
  test('ranks by quantity and breaks ties by revenue', async () => {
    await createCategory('Drinks');
    await createCategory('Food');
    const cola = await createProduct('Cola', 5, 'Drinks');
    const burger = await createProduct('Burger', 10, 'Food');

    await createSale({
      items: [saleLine(cola, 'Cola', 5, 5, cola), saleLine(burger, 'Burger', 10, 5, burger)],
      subtotal: 75,
      total: 75,
      paid: 75,
      payment_breakdown: [{ method: 'cash', amount: 75 }],
    });

    const ranked = computeBestSellers({});
    // Both sold 5 units (quantity tie); Burger wins on revenue (50 > 25).
    expect(ranked[0].name).toBe('Burger');
    expect(ranked[0].quantity).toBe(5);
    expect(ranked[0].revenue).toBeCloseTo(50);
    expect(ranked[1].name).toBe('Cola');
    expect(ranked[1].revenue).toBeCloseTo(25);
  });
});

describe('X / Z shift reports — reconcile to the shift sales', () => {
  test('X report sums the shift sales; Z report reconciles cash', async () => {
    const shift = await app.client.request('/api/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 50, till: 1 }),
    });
    const shiftId = shift.data.id;

    await createCategory('Drinks');
    const cola = await createProduct('Cola', 5, 'Drinks');
    await createSale({
      shift_id: shiftId,
      items: [saleLine(cola, 'Cola', 5, 2, cola)],
      subtotal: 10,
      total: 10,
      paid: 10,
      payment_breakdown: [{ method: 'cash', amount: 10 }],
    });
    await createSale({
      shift_id: shiftId,
      items: [saleLine(cola, 'Cola', 5, 1, cola)],
      subtotal: 5,
      total: 5,
      paid: 5,
      payment_breakdown: [{ method: 'card', amount: 5 }],
    });

    const x = await app.client.request(`/api/shifts/${shiftId}/x-report`);
    expect(x.data.totalSales).toBeCloseTo(15);
    expect(x.data.cashSales).toBeCloseTo(10);
    expect(x.data.cardSales).toBeCloseTo(5);
    expect(x.data.saleCount).toBe(2);
    expect(x.data.refundCount).toBe(0);

    // Z report is read after the shift is closed (counted cash recorded).
    await app.client.request(`/api/shifts/${shiftId}/close`, {
      method: 'POST',
      body: JSON.stringify({ countedCash: 60 }),
    });
    const z = await app.client.request(`/api/shifts/${shiftId}/z-report`);
    expect(z.data.expectedCash).toBeCloseTo(60); // float 50 + cash 10
    expect(z.data.actualCash).toBeCloseTo(60);
    expect(z.data.difference).toBeCloseTo(0);
  });

  test('X report counts refunds separately', async () => {
    const shift = await app.client.request('/api/shifts/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 0, till: 1 }),
    });
    const shiftId = shift.data.id;
    await createCategory('Drinks');
    const cola = await createProduct('Cola', 5, 'Drinks');

    await createSale({
      shift_id: shiftId,
      items: [saleLine(cola, 'Cola', 5, 2, cola)],
      subtotal: 10,
      total: 10,
      paid: 10,
      payment_breakdown: [{ method: 'cash', amount: 10 }],
    });
    await createSale({
      status: 2,
      shift_id: shiftId,
      items: [saleLine(cola, 'Cola', 5, 1, cola)],
      subtotal: 5,
      total: 5,
      paid: 5,
      payment_breakdown: [{ method: 'cash', amount: 5 }],
    });

    const x = await app.client.request(`/api/shifts/${shiftId}/x-report`);
    expect(x.data.saleCount).toBe(1); // refund not a sale
    expect(x.data.refundCount).toBe(1);
    expect(x.data.refundTotal).toBeCloseTo(5);
  });
});

describe('computeKpis — UI dashboard maths', () => {
  test('derives sales, orders, AOV, profit and margin from transactions', () => {
    const transactions = [
      {
        total: 22,
        items: [
          { price: 5, cost: 2, quantity: 2 },
          { price: 10, cost: 4, quantity: 1 },
        ],
      },
    ];
    const kpis = computeKpis({
      transactions,
      previous: [],
      held: [{ id: 1 }],
      voided: [],
    });

    expect(kpis.sales).toBeCloseTo(22);
    expect(kpis.orders).toBe(1);
    expect(kpis.aov).toBeCloseTo(22);
    // profit = (5-2)*2 + (10-4)*1 = 6 + 6 = 12
    expect(kpis.profit).toBeCloseTo(12);
    expect(kpis.marginPct).toBeCloseTo((12 / 22) * 100);
    expect(kpis.heldOrders).toBe(1);
  });

  test('handles an empty period without dividing by zero', () => {
    const kpis = computeKpis({ transactions: [], previous: [], held: [], voided: [] });
    expect(kpis.aov).toBe(0);
    expect(kpis.marginPct).toBe(0);
    expect(kpis.orders).toBe(0);
  });
});
