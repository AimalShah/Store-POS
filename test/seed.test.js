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

describe('Demo seed', () => {
  test(
    'seeds a cafe catalog with images, customers and 90 days of sales',
    async () => {
    const { data } = await app.client.request('/api/demo/seed', {
      method: 'POST',
      body: '{}',
    });
    expect(data.ok).toBe(true);
    expect(data.productsAdded).toBeGreaterThan(40);

    const { data: cats } = await app.client.request('/api/categories/all');
    const names = cats.map((c) => c.name);
    for (const expected of ['Pizzas', 'Burgers', 'Chinese', 'Soup', 'Snacks', 'Drinks', 'Deals']) {
      expect(names).toContain(expected);
    }

    // Products carry a generated image reference.
    const { data: products } = await app.client.request('/api/inventory/products');
    const withImage = products.filter((p) => typeof p.img === 'string' && p.img.startsWith('library/'));
    expect(withImage.length).toBeGreaterThan(40);

    // Sales should now exist across the last 90 days.
    const start = new Date(Date.now() - 90 * 86400000).toISOString();
    const end = new Date().toISOString();
    const { data: txns } = await app.client.request(
      `/api/by-date?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&user=0&till=0&status=1`
    );
    expect(txns.length).toBeGreaterThan(100);

    // Sale line items carry cost + categoryId snapshots.
    const item = txns[0].items[0];
    expect(typeof item.cost).toBe('number');
    expect(item.categoryId).toBeGreaterThan(0);
  },
    60000
  );

  test('creates held orders so the Held Orders KPI is populated', async () => {
    await app.client.request('/api/demo/seed', { method: 'POST', body: '{}' });
    const { data: held } = await app.client.request('/api/on-hold');
    expect(held.length).toBeGreaterThan(0);
  }, 60000);
});
