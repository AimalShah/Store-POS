import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login('admin', 'admin');
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Categories: unique constraint on name', () => {
  test('creating duplicate category returns 409', async () => {
    // Create first category
    const { status: status1, data: data1 } = await app.client.request(
      '/api/categories/category',
      { method: 'POST', body: JSON.stringify({ name: 'Drinks', icon: 'Coffee', color: 'blue' }) }
    );
    expect(status1).toBe(200);

    // Try to create duplicate
    const { status, data } = await app.client.request(
      '/api/categories/category',
      { method: 'POST', body: JSON.stringify({ name: 'Drinks', icon: 'Coffee', color: 'blue' }) }
    );
    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  test('updating to duplicate category name returns 409', async () => {
    // Create two categories
    const { data: cat1 } = await app.client.request(
      '/api/categories/category',
      { method: 'POST', body: JSON.stringify({ name: 'Drinks', icon: 'Coffee', color: 'blue' }) }
    );
    const { data: cat2 } = await app.client.request(
      '/api/categories/category',
      { method: 'POST', body: JSON.stringify({ name: 'Food', icon: 'Burger', color: 'red' }) }
    );

    console.log('cat1:', cat1, 'cat2:', cat2);

    // Check if the table has UNIQUE constraint
    const db = await import('../server/db.js');
    const indexList = db.getDb().prepare("PRAGMA index_list(categories)").all();
    console.log('Index list:', indexList);

    // Try to rename cat2 to cat1's name
    const { status, data } = await app.client.request(
      '/api/categories/category',
      { method: 'PUT', body: JSON.stringify({ id: cat2.id, name: 'Drinks', icon: 'Burger', color: 'red' }) }
    );
    console.log('Update status:', status, 'data:', data);
    expect(status).toBe(409);
    expect(data.error).toContain('already exists');
  });
});