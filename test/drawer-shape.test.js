import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Drawer session API shape', () => {
  test('sessions list returns camelCase fields; an open session has no variance yet', async () => {
    await app.client.login();

    await app.client.request('/api/drawer/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 100, till: 1 }),
    });

    const { status, data: sessions } = await app.client.request('/api/drawer?till=1');
    expect(status).toBe(200);
    expect(sessions.length).toBeGreaterThan(0);

    const open = sessions.find((s) => s.status === 'open');
    // The UI renders these directly — they must be camelCase numbers/nulls,
    // never snake_case leftovers that collapse into undefined.
    expect(open.floatAmount).toBe(100);
    expect(open.countedCash).toBeNull();
    expect(open.variance).toBeNull();
    expect(typeof open.openedAt).toBe('string');
  });

  test('a closed session carries numeric counted cash and variance', async () => {
    await app.client.login();
    const { data: opened } = await app.client.request('/api/drawer/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 100, till: 2 }),
    });

    await app.client.request(`/api/drawer/${opened.session.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ countedCash: 90 }),
    });

    const { data: sessions } = await app.client.request('/api/drawer?till=2');
    const closed = sessions.find((s) => s.id === opened.session.id);
    expect(closed.countedCash).toBe(90);
    expect(typeof closed.variance).toBe('number');
  });
});
