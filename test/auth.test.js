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
    const user = { id: 1, username: 'admin', fullname: 'Administrator' };
    const token = signToken(user);
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(1);
    expect(decoded.username).toBe('admin');
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
  test('correct PIN for a specific member returns a token and user', async () => {
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
      { method: 'POST', body: JSON.stringify({ userId: 1, pin: '1234' }) }
    );
    expect(status).toBe(200);
    expect(data.token).toBeTruthy();
  });

  test('wrong PIN returns 401', async () => {
    const { status } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ userId: 1, pin: '9999' }) }
    );
    expect(status).toBe(401);
  });

  test('empty PIN is rejected', async () => {
    const { status } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ userId: 1, pin: '' }) }
    );
    expect([400, 401]).toContain(status);
  });
});

describe('Role middleware', () => {
  test('returns 403 when the role is not allowed for the area', async () => {
    const adminLogin = await app.client.login();
    await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: 'cashier',
        password: 'cashier123',
        fullname: 'Cashier',
        role: 'Cashier',
      }),
    }, adminLogin.token);

    const login = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'cashier', password: 'cashier123' }) }
    );
    const token = login.data.token;

    const { status } = await app.client.request('/api/audit-log', {}, token);
    expect(status).toBe(403);
  });

  test('returns 200 when the role is allowed for the area', async () => {
    const login = await app.client.login();
    const { status } = await app.client.request('/api/printer/settings', {}, login.token);
    expect(status).toBe(200);
  });
});
