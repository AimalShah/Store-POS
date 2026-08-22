import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('No product-stock machinery', () => {
  test('completing a sale changes nothing about product availability', async () => {
    const { client } = app;
    await client.login();
    const product = await app.createProduct('Ledger Cola', 2.5, 'Drinks', true, 10);

    const sale = await client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: product.id, name: 'Ledger Cola', price: 2.5, quantity: 4 }],
        total: 10,
        paid: 10,
        status: 1,
      }),
    });
    expect(sale.status).toBe(200);
    expect(sale.data.ok).toBe(true);

    const { data: products } = await client.request('/api/inventory/products');
    const after = products.find((p) => p.id === product.id);
    // Sales never touch stock again: no quantity concept survives on the payload
    expect(after).not.toHaveProperty('quantity');
    expect(after).not.toHaveProperty('stock');
    expect(after).not.toHaveProperty('trackStock');
  });

  test('voiding a sale restores nothing', async () => {
    const { client } = app;
    await client.login();
    const product = await app.createProduct('Voidless Burger', 5, 'Food', true, 7);
    const sale = await client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: product.id, name: 'Voidless Burger', price: 5, quantity: 3 }],
        total: 15,
        paid: 15,
        status: 1,
      }),
    });
    expect(sale.data.ok).toBe(true);

    const voided = await client.request(`/api/transactions/${sale.data.id}/void`, { method: 'POST' });
    expect(voided.status).toBe(200);

    const { data: products } = await client.request('/api/inventory/products');
    expect(products.find((p) => p.id === product.id)).toBeTruthy();
  });

  test('no orphaned product-stock endpoints remain reachable', async () => {
    const { client } = app;
    await client.login();
    const product = await app.createProduct('Ghost Cola', 2, 'Drinks', true, 5);

    expect((await client.request(`/api/inventory/product/${product.id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ type: 'restock', quantityChange: 5 }),
    })).status).toBe(404);

    expect((await client.request(`/api/inventory/product/${product.id}/stock-movements`)).status).toBe(404);
    expect((await client.request('/api/inventory/stock-movements')).status).toBe(404);
  });
});
