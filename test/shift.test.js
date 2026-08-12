import jwt from 'jsonwebtoken';
import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Shifts: opening a shift records the cashier name', () => {
  test('stores the logged-in user name (no longer NULL)', async () => {
    const login = await app.client.login();
    const { data: shift } = await app.client.request(
      '/api/shifts/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 100, till: 1 }) },
      login.token
    );

    expect(shift.userName).toBeTruthy();
    expect(shift.userName).toBe(login.user.fullname);
  });

  test('falls back to "Unknown" when the token lacks a fullname (old-token bug)', async () => {
    const legacyToken = jwt.sign(
      { id: 1, username: 'admin', perm_transactions: 1 },
      'test-secret',
      { expiresIn: '12h' }
    );
    const res = await app.client.request(
      '/api/shifts/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 50, till: 1 }) },
      legacyToken
    );

    expect(res.data.id).toBeTruthy();
    expect(res.data.userName).toBe('Unknown');
  });
});
