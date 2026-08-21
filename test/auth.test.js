import { bootApp } from './helpers.js';
import { signToken, verifyToken, setJwtSecret } from '../server/auth.js';

let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('JWT token generation and verification', () => {
  test('signToken produces a verifiable token', () => {
    const user = { id: 1, username: 'admin', fullname: 'Administrator', perm_settings: 1 };
    const token = signToken(user);
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(1);
    expect(decoded.username).toBe('admin');
    expect(decoded.perm_settings).toBe(1);
  });

  test('verifyToken rejects a token signed with the wrong secret', () => {
    setJwtSecret('test-secret');
    const token = signToken({ id: 1, username: 'admin' });
    setJwtSecret('a-different-secret');
    expect(() => verifyToken(token)).toThrow();
  });

  test('verifyToken rejects expired tokens', () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: 1, username: 'admin' }, 'test-secret', { expiresIn: '-1s' });
    setJwtSecret('test-secret');
    expect(() => verifyToken(expired)).toThrow();
  });
});

describe('Password login', () => {
  test('correct credentials return a token and user', async () => {
    const { status, data } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin' }) }
    );
    expect(status).toBe(200);
    expect(data.token).toBeTruthy();
    expect(data.user.username).toBe('admin');
  });

  test('wrong password returns 401', async () => {
    const { status } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) }
    );
    expect(status).toBe(401);
  });

  test('nonexistent username returns 401', async () => {
    const { status } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'ghost', password: 'whatever' }) }
    );
    expect(status).toBe(401);
  });
});

describe('PIN login', () => {
  test('correct PIN returns a token and user', async () => {
    const adminLogin = await app.client.login();
    await app.client.request(
      '/api/users/post',
      {
        method: 'POST',
        body: JSON.stringify({ id: 1, username: 'admin', fullname: 'Administrator', pin: '1234' }),
      },
      adminLogin.token
    );

    const { status, data } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ pin: '1234' }) }
    );
    expect(status).toBe(200);
    expect(data.token).toBeTruthy();
  });

  test('wrong PIN returns 401', async () => {
    const { status } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ pin: '9999' }) }
    );
    expect(status).toBe(401);
  });

  test('empty PIN is rejected', async () => {
    const { status } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ pin: '' }) }
    );
    expect([400, 401]).toContain(status);
  });
});

describe('Permission middleware (requirePerm)', () => {
  test('returns 403 when the user lacks the permission', async () => {
    const adminLogin = await app.client.login();
    const { data: created } = await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: 'noperms',
        password: 'noperms123',
        fullname: 'No Perms',
        perm_products: 0,
        perm_categories: 0,
        perm_transactions: 0,
        perm_users: 0,
        perm_settings: 0,
      }),
    }, adminLogin.token);
    expect(created.id).toBeTruthy();

    const login = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'noperms', password: 'noperms123' }) }
    );
    const token = login.data.token;

    const { status } = await app.client.request('/api/audit-log', {}, token);
    expect(status).toBe(403);
  });

  test('returns 200 when the user has the permission', async () => {
    const login = await app.client.login();
    const { status } = await app.client.request('/api/printer/settings', {}, login.token);
    expect(status).toBe(200);
  });
});
