import { bootApp } from './helpers.js';
import { resetLoginRateLimit } from '../server/auth.js';

let app;
beforeEach(async () => {
  process.env.NODE_ENV = 'production';
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
  process.env.NODE_ENV = 'test';
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
    for (let i = 0; i < 50; i++) {
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
  });

  test('blocks PIN login after max attempts exceeded', async () => {
    for (let i = 0; i < 50; i++) {
      await app.client.request(
        '/api/users/login-pin',
        { method: 'POST', body: JSON.stringify({ pin: '0000' }) }
      );
    }

    const { status, data } = await app.client.request(
      '/api/users/login-pin',
      { method: 'POST', body: JSON.stringify({ pin: '0000' }) }
    );

    expect(status).toBe(429);
    expect(data.error).toContain('Too many login attempts');
  });

  test('rate limit is per IP address', async () => {
    const client = app.client;
    for (let i = 0; i < 50; i++) {
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
  });
});