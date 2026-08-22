import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Stock summary cards', () => {
  test('counts items, out-of-stock and today’s changes', async () => {
    await app.client.login();

    const { data: eggs } = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'eggs', unit: 'pcs', costPerUnit: 5 }),
    });
    const { data: flour } = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'flour', unit: 'kg' }),
    });

    // eggs in then all used up → out of stock
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: eggs.id, quantity: 12, paid: 60 }),
    });
    await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: eggs.id, quantity: 12, type: 'usage' }),
    });
    // flour still healthy
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: flour.id, quantity: 10, paid: 300 }),
    });

    const { status, data: s } = await app.client.request('/api/stock/summary');
    expect(status).toBe(200);
    expect(s.items).toBe(2);
    expect(s.outOfStock).toBe(1);
    // restock + usage + restock all happened today
    expect(s.changesToday).toBeGreaterThanOrEqual(3);

    // a brand-new item with no entries yet is NOT counted as out of stock
    await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'basil', unit: 'g' }),
    });
    const fresh = await app.client.request('/api/stock/summary');
    expect(fresh.data.items).toBe(3);
    expect(fresh.data.outOfStock).toBe(1);
  });
});
