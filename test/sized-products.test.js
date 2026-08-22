import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

function sizedProductForm(overrides = {}) {
  const fd = new FormData();
  fd.append('id', '');
  fd.append('name', 'Pizza Margherita');
  fd.append('price', '');
  fd.append('cost', '');
  fd.append('category', 'Pizzas');
  fd.append('img', '');
  fd.append(
    'sizes',
    JSON.stringify([
      { name: 'Small', price: 7, cost: 2.5, position: 0 },
      { name: 'Large', price: 11, cost: 4.5, position: 1 },
    ])
  );
  for (const [k, v] of Object.entries(overrides)) fd.append(k, String(v));
  return fd;
}

describe('Either/or price vs sizes; cost rides size rows', () => {
  test('a sized product saves per-size costs and returns them', async () => {
    await app.client.login();
    await app.client.request('/api/inventory/product', { method: 'POST', body: sizedProductForm() });

    const { data: products } = await app.client.request('/api/inventory/products');
    const pizza = products.find((p) => p.name === 'Pizza Margherita');
    expect(pizza.sizes).toHaveLength(2);

    const large = pizza.sizes.find((s) => s.name === 'Large');
    expect(large.price).toBe(11);
    expect(large.cost).toBe(4.5);
    // A sized product has no independent base price: it sells "from" the cheapest size
    expect(pizza.price).toBe(7);
  });

  test('margin reporting uses the sold size\'s cost, not a product-level cost', async () => {
    await app.client.login();
    await app.client.request('/api/inventory/product', { method: 'POST', body: sizedProductForm() });
    const { data: products } = await app.client.request('/api/inventory/products');
    const pizza = products.find((p) => p.name === 'Pizza Margherita');

    const sale = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({
        items: [
          {
            id: pizza.id,
            name: 'Pizza Margherita',
            price: 11,
            quantity: 2,
            selectedVariants: [{ group: 'Size', name: 'Large', priceDelta: 4 }],
          },
        ],
        total: 22,
        paid: 22,
        status: 1,
      }),
    });
    expect(sale.data.ok).toBe(true);

    const { data: tx } = await app.client.request(`/api/transaction/${sale.data.id}`);
    // Large costs 4.50 each, so the line's snapshot must carry that — not 0, not a base cost
    expect(tx.items[0].cost).toBe(4.5);
  });

  test('removing all sizes returns the product to simple pricing', async () => {
    await app.client.login();
    await app.client.request('/api/inventory/product', { method: 'POST', body: sizedProductForm() });
    const { data: products } = await app.client.request('/api/inventory/products');
    const pizza = products.find((p) => p.name === 'Pizza Margherita');

    const fd = new FormData();
    fd.append('id', String(pizza.id));
    fd.append('name', 'Pizza Margherita');
    fd.append('price', '9');
    fd.append('cost', '3');
    fd.append('sizes', '[]');
    fd.append('img', '');
    const saved = await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    expect(saved.status).toBe(200);

    const after = await app.client.request(`/api/inventory/product/${pizza.id}`);
    expect(after.data.sizes).toHaveLength(0);
    expect(after.data.price).toBe(9);
    expect(after.data.cost).toBe(3);
  });
});
