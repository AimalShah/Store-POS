import { bootApp } from './helpers.js';

let app;
let token;

beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
  token = undefined; // admin is the default client token
});

afterEach(async () => {
  await app.close();
  app.cleanup();
});

async function createIngredient(name, unit = 'pcs') {
  const { data } = await app.client.request('/api/stock/ingredients', {
    method: 'POST',
    body: JSON.stringify({ name, unit }),
  });
  return data;
}

describe('Usage & wastage logging', () => {
  test('usage deducts immediately and carries actor attribution', async () => {
    const dough = await createIngredient('dough', 'kg');
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: dough.id, quantity: 20 }),
    });

    const used = await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: dough.id, quantity: 3, type: 'usage', note: 'morning prep' }),
    });
    expect(used.status).toBe(200);

    const { data: list } = await app.client.request('/api/stock/ingredients');
    expect(list.find((i) => i.id === dough.id).balance).toBe(17);
    expect(list.find((i) => i.id === dough.id).lastEntry.userName).toBe('Administrator');
    expect(list.find((i) => i.id === dough.id).lastEntry.type).toBe('usage');
  });

  test('wastage requires a reason', async () => {
    const eggs = await createIngredient('eggs');
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: eggs.id, quantity: 30 }),
    });

    const noReason = await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: eggs.id, quantity: 4, type: 'wastage', note: '' }),
    });
    expect(noReason.status).toBe(400);

    const wasted = await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: eggs.id, quantity: 4, type: 'wastage', note: 'dropped the tray' }),
    });
    expect(wasted.status).toBe(200);

    const { data: list } = await app.client.request('/api/stock/ingredients');
    expect(list.find((i) => i.id === eggs.id).balance).toBe(26);
  });

  test('entries that would push a balance below zero are rejected with a clear error', async () => {
    const cheese = await createIngredient('cheese', 'kg');
    const rejected = await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: cheese.id, quantity: 2, type: 'usage' }),
    });
    expect(rejected.status).toBe(400);
    expect(rejected.data.error).toMatch(/below zero|insufficient/i);

    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: cheese.id, quantity: 5 }),
    });
    const over = await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: cheese.id, quantity: 6, type: 'usage' }),
    });
    expect(over.status).toBe(400);

    // Balance untouched by the failed attempts
    const { data: list } = await app.client.request('/api/stock/ingredients');
    expect(list.find((i) => i.id === cheese.id).balance).toBe(5);
  });

  test('the movements history lists every entry kind with actor, quantity and reason; filters apply', async () => {
    const flour = await createIngredient('flour', 'kg');
    await app.client.request('/api/stock/restock', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: flour.id, quantity: 25, note: 'weekly order' }),
    });
    await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: flour.id, quantity: 8, type: 'usage' }),
    });
    await app.client.request('/api/stock/usage', {
      method: 'POST',
      body: JSON.stringify({ ingredientId: flour.id, quantity: 1, type: 'wastage', note: 'weevils' }),
    });

    let { status, data } = await app.client.request('/api/stock/entries');
    expect(status).toBe(200);
    expect(data.total).toBe(3);
    const types = data.entries.map((e) => e.type).sort();
    expect(types).toEqual(['restock', 'usage', 'wastage']);
    expect(data.entries.every((e) => e.userName === 'Administrator')).toBe(true);
    expect(data.entries.every((e) => e.unit === 'kg')).toBe(true);
    const wastageRow = data.entries.find((e) => e.type === 'wastage');
    expect(wastageRow.note).toBe('weevils');

    // Filter by type
    ({ data } = await app.client.request('/api/stock/entries?type=restock'));
    expect(data.total).toBe(1);
    expect(data.entries[0].type).toBe('restock');

    // Filter by ingredient
    ({ data } = await app.client.request(`/api/stock/entries?ingredientId=${flour.id}`));
    expect(data.total).toBe(3);

    // Ledger math holds: 25 − 8 − 1
    const { data: list } = await app.client.request('/api/stock/ingredients');
    expect(list.find((i) => i.id === flour.id).balance).toBe(16);
  });
});
