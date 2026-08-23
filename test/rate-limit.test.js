import { bootApp } from './helpers.js';
import { resetLoginRateLimit } from '../server/auth.js';

let app;
beforeEach(async () => {
  process.env.NODE_ENV = 'production';
  process.env.LOGIN_MAX_ATTEMPTS = '50';
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
  process.env.NODE_ENV = 'test';
  delete process.env.LOGIN_MAX_ATTEMPTS;
  resetLoginRateLimit();
});

describe('Rate limiting on login endpoints', () => {
  test('allows login under rate limit', async () => {
    const { status, data } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'admin' }) }
    );
    expect(status).toBe(200);
    expect(data.token).toBeTruthy();
  });

  test('blocks login after max attempts exceeded', async () => {
    for (let i = 0; i < 51; i++) {
      await app.client.request(
        '/api/users/login',
        { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) }
      );
    }

    const { status, data } = await app.client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) }
    );

    expect(status).toBe(429);
    expect(data.error).toContain('Too many login attempts');
  }, 15000);

  test('blocks PIN login after max attempts exceeded', async () => {
    for (let i = 0; i < 51; i++) {
      await app.client.request(
        '/api/users/login-pin',
        { method: 'POST', body: JSON.stringify({ userId: 1, pin: '0000' }) }
      );
    }

    const { status, data } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ userId: 1, pin: '0000' }) }
    );

    expect(status).toBe(429);
    expect(data.error).toContain('Too many login attempts');
  }, 15000);

  test('rate limit is per IP address', async () => {
    const client = app.client;
    for (let i = 0; i < 51; i++) {
      await client.request(
        '/api/users/login',
        { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) }
      );
    }

    const { status } = await client.request(
      '/api/users/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) }
    );
    expect(status).toBe(429);
  }, 15000);
});