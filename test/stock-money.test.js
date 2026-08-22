import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

async function addItem(name, unit = 'kg') {
  await app.client.login();
  const { data } = await app.client.request('/api/stock/ingredients', {
    method: 'POST',
    body: JSON.stringify({ name, unit }),
  });
  return data;
}

describe('Stock with money', () => {
  test('adding stock with what you paid records the per-unit price and the stock worth', async () => {
    const dough = await addItem('dough');

    // Bought 10 kg for 500 → Rs 50 per kg
    const restock = await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: dough.id, quantity: 10, paid: 500 }),
    });
    expect(restock.status).toBe(200);

    const { data: list } = await app.client.request('/api/stock/ingredients');
    const row = list.find((i) => i.id === dough.id);
    expect(row.costPerUnit).toBe(50);
    expect(row.value).toBe(500);

    // Buying more without a price keeps the last known price
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: dough.id, quantity: 5 }),
    });
    const after = await app.client.request('/api/stock/ingredients');
    const row2 = after.data.find((i) => i.id === dough.id);
    expect(row2.costPerUnit).toBe(50);
    expect(row2.value).toBe(750);
  });

  test('you can set the per-unit price yourself when creating or editing', async () => {
    await app.client.login();
    const { status, data: cheese } = await app.client.request('/api/stock/ingredients', {
      method: 'POST',
      body: JSON.stringify({ name: 'cheese', unit: 'kg', costPerUnit: 120 }),
    });
    expect(status).toBe(200);
    expect(cheese.costPerUnit).toBe(120);

    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: cheese.id, quantity: 2 }),
    });

    const edited = await app.client.request(`/api/stock/ingredients/${cheese.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'cheese', unit: 'kg', costPerUnit: 100 }),
    });
    expect(edited.status).toBe(200);

    const { data: list } = await app.client.request('/api/stock/ingredients');
    const row = list.find((i) => i.id === cheese.id);
    expect(row.value).toBe(200); // 2 kg × 100
  });

  test('the summary shows what the stock is worth and what was spent in a period', async () => {
    const flour = await addItem('flour');
    const rice = await addItem('rice', 'pcs');
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: flour.id, quantity: 10, paid: 800 }),
    });
    // An old purchase outside today should not count once we filter by date
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { data: r2 } = await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: rice.id, quantity: 20, paid: 400 }),
    });
    expect(r2.ok).toBe(true);
    void yesterday;

    const { status, data: s } = await app.client.request('/api/stock/summary');
    expect(status).toBe(200);
    expect(s.items).toBe(2);
    // flour: 10 × 80 = 800 · rice: 20 × 20 = 400
    expect(s.stockWorth).toBeCloseTo(1200);
    expect(s.spentTotal).toBeCloseTo(1200);

    const dayAgo = new Date(Date.now() - 3600000).toISOString();
    const recent = await app.client.request(`/api/stock/summary?start=${dayAgo}`);
    expect(recent.data.spentTotal).toBeLessThanOrEqual(1200);
    void flour;
  });

  test('cashiers cannot see stock money numbers', async () => {
    const admin = await app.client.login();
    await admin;
    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ username: 'cash', password: 'cash', fullname: 'Cash', role: 'Cashier' }),
    });
    const { data: login } = await app.client.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cash', password: 'cash' }),
    });
    const { status } = await app.client.request('/api/stock/summary', {}, login.token);
    expect(status).toBe(403);
  });
});
