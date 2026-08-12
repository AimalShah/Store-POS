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

async function createCategory(name) {
  await app.client.request('/api/categories/category', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  const { data } = await app.client.request('/api/categories/all');
  return data.find((c) => c.name === name);
}

async function createProductWithCost(name, price, category, cost) {
  await app.client.login();
  const fd = new FormData();
  fd.append('id', '');
  fd.append('name', name);
  fd.append('price', String(price));
  fd.append('category', category);
  fd.append('quantity', '50');
  fd.append('stock', '1');
  fd.append('img', '');
  fd.append('cost', String(cost));
  const { data } = await app.client.request('/api/inventory/product', {
    method: 'POST',
    body: fd,
  });
  return data.id;
}

async function makeSale(items, total) {
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
      date: new Date().toISOString(),
    }),
  });
  return data;
}

describe('Product cost (COGS)', () => {
  test('storing a product with cost returns it via the products API', async () => {
    const id = await createProductWithCost('Cola', 2, 'Drinks', 1.2);
    const { data } = await app.client.request(`/api/inventory/product/${id}`);
    expect(data.cost).toBe(1.2);
  });

  test('a sale line item snapshots the product cost and categoryId', async () => {
    const cat = await createCategory('Drinks');
    const id = await createProductWithCost('Cola', 2, 'Drinks', 1.2);
    await makeSale([{ id, name: 'Cola', price: 2, quantity: 1 }], 2);

    const { data: txns } = await app.client.request(
      '/api/by-date?start=2000-01-01&end=2100-01-01&user=0&till=0&status=1'
    );
    const item = txns[0].items[0];
    expect(item.cost).toBe(1.2);
    expect(item.categoryId).toBe(cat.id);
  });
});
