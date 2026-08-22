import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Tap-name → PIN login', () => {
  let adminToken;

  beforeEach(async () => {
    const login = await app.client.login();
    adminToken = login.token;
    // Two PIN-holding members
    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ username: 'cara', password: 'x', fullname: 'Cara Cashier', role: 'Cashier', pin: '1111' }),
    }, adminToken);
    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({ username: 'manny', password: 'x', fullname: 'Manny Manager', role: 'Manager', pin: '2222' }),
    }, adminToken);
  });

  test('the login screen lists team member tiles with name and role', async () => {
    const { status, data } = await app.client.request('/api/users/pin-users');
    expect(status).toBe(200);
    const cara = data.find((u) => u.fullname === 'Cara Cashier');
    expect(cara.role).toBe('Cashier');
    expect(data.find((u) => u.fullname === 'Manny Manager').role).toBe('Manager');
    // No hashes or pins leak
    expect(cara.pin).toBeUndefined();
    expect(cara.password).toBeUndefined();
  });

  test('tapping a member and entering their PIN signs in as that person', async () => {
    const tiles = await app.client.request('/api/users/pin-users');
    const cara = tiles.data.find((u) => u.fullname === 'Cara Cashier');

    const { status, data } = await app.client.request('/api/users/login-pin', {
      method: 'POST',
      body: JSON.stringify({ userId: cara.id, pin: '1111' }),
    });
    expect(status).toBe(200);
    expect(data.user.fullname).toBe('Cara Cashier');
    expect(data.user.role).toBe('Cashier');
    expect(data.token).toBeTruthy();
  });

  test("another member's PIN is rejected — verification checks only that tile's hash", async () => {
    const tiles = await app.client.request('/api/users/pin-users');
    const cara = tiles.data.find((u) => u.fullname === 'Cara Cashier');

    // Manny's PIN must not open Cara's account
    const { status } = await app.client.request('/api/users/login-pin', {
      method: 'POST',
      body: JSON.stringify({ userId: cara.id, pin: '2222' }),
    });
    expect(status).toBe(401);

    // And Cara's own PIN still works
    const ok = await app.client.request('/api/users/login-pin', {
      method: 'POST',
      body: JSON.stringify({ userId: cara.id, pin: '1111' }),
    });
    expect(ok.status).toBe(200);
  });

  test('the status column no longer stores login timestamps; last-login reads proper data', async () => {
    const tiles = await app.client.request('/api/users/pin-users');
    const cara = tiles.data.find((u) => u.fullname === 'Cara Cashier');
    await app.client.request('/api/users/login-pin', {
      method: 'POST',
      body: JSON.stringify({ userId: cara.id, pin: '1111' }),
    });

    const { data: users } = await app.client.request('/api/users/all', {}, adminToken);
    const caraRow = users.find((u) => u.username === 'cara');
    expect(caraRow.status).not.toMatch(/^Logged In_/);
    expect(caraRow.lastLoginAt).toBeTruthy();

    const mannyRow = users.find((u) => u.username === 'manny');
    expect(mannyRow.lastLoginAt).toBeFalsy();
  });
});
