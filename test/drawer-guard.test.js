import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login('admin', 'admin', { openDrawer: false });
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Drawer guard', () => {
  test('POST /api/new is blocked when no drawer session is open on the till', async () => {
    const { status, data } = await app.client.request('/api/new', {
      method: 'POST',
      headers: { 'x-test-no-auto-drawer': 'true' },
      body: JSON.stringify({
        status: 1,
        till: 1,
        total: 10,
        paid: 10,
        payment_type: 1,
        payment_breakdown: [{ method: 'cash', amount: 10 }],
        items: [],
      }),
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/drawer/i);
  });

  test('POST /api/new succeeds when a drawer session is open on the till', async () => {
    await app.client.request('/api/drawer/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 100, till: 1 }),
    });

    const { status, data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({
        status: 1,
        till: 1,
        total: 10,
        paid: 10,
        payment_type: 1,
        payment_breakdown: [{ method: 'cash', amount: 10 }],
        items: [],
      }),
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });
});
