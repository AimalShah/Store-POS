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

describe('Printer: test print endpoint', () => {
  test('returns 400 when no printer is configured', async () => {
    const { status, data } = await app.client.request('/api/printer/test', {
      method: 'POST',
    });
    expect(status).toBe(400);
    expect(data.error).toMatch(/no printer/i);
  });

  test('returns success with test print content when printer is configured', async () => {
    await app.client.request('/api/printer/settings', {
      method: 'POST',
      body: JSON.stringify({ interface: 'network', networkHost: '192.168.1.50', networkPort: 9100, width: 80, autoPrintKot: false }),
    });

    const { status, data } = await app.client.request('/api/printer/test', {
      method: 'POST',
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.message).toMatch(/test print/i);
    expect(data.content).toMatch(/TEST PRINT/);
    expect(data.content).toMatch(/Interface: network/);
  });

  test('requires perm_settings permission', async () => {
    await app.client.request('/api/printer/settings', {
      method: 'POST',
      body: JSON.stringify({ interface: 'usb', usbDevice: '0x0416:0x5011', width: 58, autoPrintKot: false }),
    });

    const cashier = await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: 'cashier',
        password: 'cashier123',
        fullName: 'Cashier',
        perm_products: 0,
        perm_categories: 0,
        perm_transactions: 1,
        perm_users: 0,
        perm_settings: 0,
      }),
    });
    const login = await app.client.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'cashier123' }),
    });
    const token = login.data.token;

    const { status } = await app.client.request('/api/printer/test', { method: 'POST' }, token);
    expect(status).toBe(403);
  });
});
