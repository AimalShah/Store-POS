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
    body: JSON.stringify({ name, icon: 'Utensils' }),
  });
  return data;
}

async function createProduct(name, categoryId) {
  const fd = new FormData();
  fd.append('id', '');
  fd.append('name', name);
  fd.append('price', '8.5');
  fd.append('cost', '3');
  fd.append('category', '');
  fd.append('category_id', String(categoryId));
  fd.append('img', '');
  const { data } = await app.client.request('/api/inventory/product', {
    method: 'POST',
    body: fd,
  });
  return data;
}

describe('Product Section UI round-trip (simulated)', () => {
  test('creating a Product with a chosen Section persists it', async () => {
    await app.client.login();
    const cat = await createCategory('Burgers');
    const product = await createProduct('Zinger Burger', cat.id);
    
    expect(product.category_id).toBe(cat.id);
    expect(product.category).toBe('Burgers');
  });

  test('editing a Product to a different Section updates it', async () => {
    await app.client.login();
    const burgers = await createCategory('Burgers');
    const drinks = await createCategory('Drinks');
    
    const product = await createProduct('Zinger Burger', burgers.id);
    expect(product.category_id).toBe(burgers.id);
    expect(product.category).toBe('Burgers');
    
    // Simulate editing the product - this is what the UI does
    const fd = new FormData();
    fd.append('id', String(product.id));
    fd.append('name', 'Zinger Burger');
    fd.append('price', '8.5');
    fd.append('cost', '3');
    fd.append('category', product.category);  // This is what the UI sends - the OLD category name
    fd.append('category_id', String(drinks.id));  // But category_id is the NEW one
    fd.append('img', '');
    
    await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    
    const after = await app.client.request(`/api/inventory/product/${product.id}`);
    expect(after.data.category_id).toBe(drinks.id);
    expect(after.data.category).toBe('Drinks');
  });
  
  test('editing a Product without changing Section keeps it', async () => {
    await app.client.login();
    const burgers = await createCategory('Burgers');
    
    const product = await createProduct('Zinger Burger', burgers.id);
    
    // Simulate editing WITHOUT changing section - UI sends both category and category_id
    const fd = new FormData();
    fd.append('id', String(product.id));
    fd.append('name', 'Zinger Burger Updated');
    fd.append('price', '9.5');
    fd.append('cost', '3');
    fd.append('category', product.category);  // Same category name
    fd.append('category_id', String(product.category_id));  // Same category_id
    fd.append('img', '');
    
    await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    
    const after = await app.client.request(`/api/inventory/product/${product.id}`);
    expect(after.data.category_id).toBe(burgers.id);
    expect(after.data.category).toBe('Burgers');
    expect(after.data.name).toBe('Zinger Burger Updated');
  });
});
