import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Per-user locale preference (B1)', () => {
  test('login returns default locale en', async () => {
    const { status, data } = await app.client.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    expect(status).toBe(200);
    expect(data.user.locale).toBe('en');
  });

  test('profile endpoint updates and persists user locale', async () => {
    const { data: loginData } = await app.client.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    const token = loginData.token;

    const { status: putStatus, data: putData } = await app.client.request('/api/users/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ locale: 'ur' }),
    });
    expect(putStatus).toBe(200);
    expect(putData.user.locale).toBe('ur');

    // Verify persistence on re-login
    const { data: reLoginData } = await app.client.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    expect(reLoginData.user.locale).toBe('ur');
  });
});
