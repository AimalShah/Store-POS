import { bootApp } from './helpers.js';

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

async function makeSale({ items, breakdown, total, date }) {
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
      payment_breakdown: breakdown,
      items,
      date: date || new Date().toISOString(),
    }),
  });
  return data;
}

describe('Reports: summary by category, method and best sellers', () => {
  test('totals by payment method reflect the split breakdown', async () => {
    const cola = await makeProduct('Cola', 2, 'Drinks');
    await makeSale({
      items: [{ id: cola, name: 'Cola', price: 2, quantity: 1 }],
      breakdown: [
        { method: 'cash', amount: 1 },
        { method: 'card', amount: 1 },
      ],
      total: 2,
    });

    const { data } = await app.client.request('/api/reports/summary');
    const byMethod = Object.fromEntries(
      data.byPaymentMethod.map((m) => [m.method, m.amount])
    );
    expect(byMethod.cash).toBe(1);
    expect(byMethod.card).toBe(1);
  });

  test('totals by category and best-selling items are computed', async () => {
    const cola = await makeProduct('Cola', 2, 'Drinks');
    const fries = await makeProduct('Fries', 3, 'Food');

    await makeSale({
      items: [
        { id: cola, name: 'Cola', price: 2, quantity: 1 },
        { id: fries, name: 'Fries', price: 3, quantity: 2 },
      ],
      breakdown: [{ method: 'cash', amount: 8 }],
      total: 8,
    });

    const { data } = await app.client.request('/api/reports/summary');
    const byCat = Object.fromEntries(data.byCategory.map((c) => [c.category, c.revenue]));
    expect(byCat.Drinks).toBe(2);
    expect(byCat.Food).toBe(6);

    const best = data.bestSellers[0];
    expect(best.name).toBe('Fries');
    expect(best.quantity).toBe(2);
  });

  test('respects the date-range filter', async () => {
    const cola = await makeProduct('Cola', 2, 'Drinks');
    await makeSale({
      items: [{ id: cola, name: 'Cola', price: 2, quantity: 1 }],
      breakdown: [{ method: 'cash', amount: 2 }],
      total: 2,
    });

    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const { data } = await app.client.request(
      `/api/reports/summary?start=${encodeURIComponent(yesterday)}&end=${encodeURIComponent(yesterday)}`
    );
    expect(data.summary.saleCount).toBe(0);
  });
});
