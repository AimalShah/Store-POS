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

describe('Product hot flag', () => {
  test('newly created product exposes hot: false in the products list', async () => {
    const product = await app.createProduct('Zinger Burger', 5.5, 'Burgers');

    const { data: list } = await app.client.request('/api/inventory/products');
    const found = list.find((p) => p.id === product.id);

    expect(found).toBeDefined();
    expect(found.hot).toBe(false);
  });

  test('single product payload includes hot field', async () => {
    const product = await app.createProduct('Cola', 2.5, 'Drinks');

    const { data } = await app.client.request(`/api/inventory/product/${product.id}`);

    expect(data.hot).toBe(false);
  });

  test('toggle endpoint marks a product hot and persists across reload', async () => {
    const product = await app.createProduct('Pizza', 8, 'Mains');

    const { status, data } = await app.client.request(
      `/api/inventory/product/${product.id}/hot`,
      { method: 'POST', body: JSON.stringify({ hot: true }) }
    );

    expect(status).toBe(200);
    expect(data.hot).toBe(true);

    const { data: reloaded } = await app.client.request(`/api/inventory/product/${product.id}`);
    expect(reloaded.hot).toBe(true);
  });

  test('toggle endpoint can clear the hot flag', async () => {
    const product = await app.createProduct('Fries', 3, 'Sides');
    await app.client.request(`/api/inventory/product/${product.id}/hot`, {
      method: 'POST',
      body: JSON.stringify({ hot: true }),
    });

    const { data } = await app.client.request(`/api/inventory/product/${product.id}/hot`, {
      method: 'POST',
      body: JSON.stringify({ hot: false }),
    });

    expect(data.hot).toBe(false);
  });
});
