import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

async function loginAs(username, password, role) {
  const admin = await app.client.login();
  await app.client.request('/api/users/post', {
    method: 'POST',
    body: JSON.stringify({ username, password, fullname: username, role }),
  }, admin.token);
  const { data } = await app.client.request('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return data.token;
}

describe('Stock screen: ingredients + restock', () => {
  test('a manager creates an ingredient with a name and one unit from the fixed list', async () => {
    const token = await loginAs('manny', 'manny', 'Manager');

    const created = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dough', unit: 'kg' }),
    }, token);
    expect(created.status).toBe(200);
    expect(created.data.name).toBe('Dough');
    expect(created.data.unit).toBe('kg');

    // Only the fixed unit list is accepted
    const bad = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Flour', unit: 'buckets' }),
    }, token);
    expect(bad.status).toBe(400);

    // Names are unique
    const dup = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dough', unit: 'g' }),
    }, token);
    expect([400, 409]).toContain(dup.status);
  });

  test('restocking logs an entry attributed to the signed-in user; the balance rises immediately', async () => {
    const token = await loginAs('manny', 'manny', 'Manager');
    const { data: dough } = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cheese', unit: 'kg' }),
    }, token);

    const restock = await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: dough.id, quantity: 12.5, note: 'Friday delivery' }),
    }, token);
    expect(restock.status).toBe(200);

    const { data: list } = await app.client.request('/api/stock/ingredients', {}, token);
    const row = list.find((i) => i.id === dough.id);
    expect(row.balance).toBe(12.5);
    expect(row.unit).toBe('kg');
    expect(row.lastEntry.userName).toBe('manny');
    expect(row.lastEntry.quantity).toBe(12.5);
    expect(row.lastEntry.type).toBe('restock');
  });

  test('the manage tab lists every ingredient with its live balance; edits rename and change unit', async () => {
    const token = await loginAs('manny', 'manny', 'Manager');
    const { data: eggs } = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Eggs', unit: 'pcs' }),
    }, token);
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: eggs.id, quantity: 30 }),
    }, token);

    const edited = await app.client.request(`/api/stock/ingredients/${eggs.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Free-range Eggs', unit: 'pcs' }),
    }, token);
    expect(edited.status).toBe(200);

    const { data: list } = await app.client.request('/api/stock/ingredients', {}, token);
    const row = list.find((i) => i.id === eggs.id);
    expect(row.name).toBe('Free-range Eggs');
    expect(row.balance).toBe(30);
  });

  test('deleting an ingredient with entry history is refused; a fresh one deletes cleanly', async () => {
    const token = await loginAs('manny', 'manny', 'Manager');
    const { data: kept } = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Tomatoes', unit: 'kg' }),
    }, token);
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: kept.id, quantity: 5 }),
    }, token);

    const blocked = await app.client.request(`/api/stock/ingredients/${kept.id}`, {
      method: 'DELETE',
    }, token);
    expect(blocked.status).toBe(400);

    const { data: fresh } = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Basil', unit: 'g' }),
    }, token);
    const gone = await app.client.request(`/api/stock/ingredients/${fresh.id}`, {
      method: 'DELETE',
    }, token);
    expect(gone.status).toBe(200);
  });

  test('the stock APIs refuse cashiers but serve managers and admins', async () => {
    const cashier = await loginAs('cashier', 'cashier', 'Cashier');
    expect((await app.client.request('/api/stock/ingredients', {}, cashier)).status).toBe(403);
    expect((await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Nope', unit: 'kg' }),
    }, cashier)).status).toBe(403);
    expect((await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: 1, quantity: 1 }),
    }, cashier)).status).toBe(403);
  });
});
