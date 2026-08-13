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

async function makeSale({ items, total, date, till = 1 }) {
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
      till,
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

describe('Best Sellers endpoint', () => {
  test('ranks products by units sold desc within the trailing 30 days', async () => {
    const cola = await makeProduct('Cola', 2, 'Drinks');
    const fries = await makeProduct('Fries', 3, 'Food');

    await makeSale({
      items: [{ id: cola, name: 'Cola', price: 2, quantity: 2 }],
      total: 4,
    });
    await makeSale({
      items: [{ id: fries, name: 'Fries', price: 3, quantity: 5 }],
      total: 15,
    });

    const { data } = await app.client.request('/api/reports/best-sellers');

    expect(data.map((p) => p.id)).toEqual([fries, cola]);
    expect(data[0]).toMatchObject({ id: fries, name: 'Fries', quantity: 5, revenue: 15 });
  });

  test('falls back to all-time ranking when the 30-day window has no sales', async () => {
    const old = await makeProduct('Legacy Pie', 4, 'Food');
    await makeSale({
      items: [{ id: old, name: 'Legacy Pie', price: 4, quantity: 9 }],
      total: 36,
      date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { data } = await app.client.request('/api/reports/best-sellers');

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: old, name: 'Legacy Pie', quantity: 9 });
  });

  test('respects the till scope', async () => {
    const till1Item = await makeProduct('Till1 Special', 5, 'Food');
    const till2Item = await makeProduct('Till2 Special', 6, 'Food');

    await makeSale({
      items: [{ id: till1Item, name: 'Till1 Special', price: 5, quantity: 4 }],
      total: 20,
      till: 1,
    });
    await makeSale({
      items: [{ id: till2Item, name: 'Till2 Special', price: 6, quantity: 7 }],
      total: 42,
      till: 2,
    });

    const { data } = await app.client.request('/api/reports/best-sellers?till=1');

    expect(data.map((p) => p.id)).toEqual([till1Item]);
  });
});
