import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

async function createCategory(name) {
  const { data } = await app.client.request('/api/categories/category', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data;
}

function productForm(overrides = {}) {
  const fd = new FormData();
  fd.append('id', '');
  fd.append('name', 'Zinger Burger');
  fd.append('price', '8.5');
  fd.append('cost', '3');
  fd.append('category', '');
  fd.append('img', '');
  for (const [k, v] of Object.entries(overrides)) fd.append(k, String(v));
  return fd;
}

describe('Product Section round-trip', () => {
  test('creating a Product with a chosen Section persists it with its name', async () => {
    await app.client.login();
    const cat = await createCategory('Burgers');

    // Exactly what the fixed product form sends: section id only, no legacy name.
    await app.client.request('/api/inventory/product', {
      method: 'POST',
      body: productForm({ category_id: cat.id }),
    });

    const { data: products } = await app.client.request('/api/inventory/products');
    const saved = products.find((p) => p.name === 'Zinger Burger');
    expect(saved.category_id).toBe(cat.id);
    expect(saved.category).toBe('Burgers');
  });

  test('editing a Product to a different Section updates it', async () => {
    await app.client.login();
    const burgers = await createCategory('Burgers');
    const drinks = await createCategory('Drinks');

    await app.client.request('/api/inventory/product', {
      method: 'POST',
      body: productForm({ category_id: burgers.id }),
    });
    const { data: products } = await app.client.request('/api/inventory/products');
    const saved = products.find((p) => p.name === 'Zinger Burger');

    const fd = new FormData();
    fd.append('id', String(saved.id));
    fd.append('name', 'Zinger Burger');
    fd.append('price', '8.5');
    fd.append('cost', '3');
    fd.append('category', '');
    fd.append('category_id', String(drinks.id));
    fd.append('img', '');
    await app.client.request('/api/inventory/product', { method: 'POST', body: fd });

    const after = await app.client.request(`/api/inventory/product/${saved.id}`);
    expect(after.data.category_id).toBe(drinks.id);
    expect(after.data.category).toBe('Drinks');
  });
});
