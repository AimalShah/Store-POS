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

describe('Drawer: summary does not crash with closed sessions', () => {
  test('GET /api/drawer/summary returns correctly after open+close cycle', async () => {
    const { data: open } = await app.client.request(
      '/api/drawer/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 100, till: 1 }) }
    );
    expect(open.session).toBeTruthy();

    const sessionId = open.session.id;
    const { data: closed } = await app.client.request(
      `/api/drawer/${sessionId}/close`,
      { method: 'POST', body: JSON.stringify({ countedCash: 105 }) }
    );
    expect(closed.session.status).toBe('closed');

    const { status, data: summary } = await app.client.request('/api/drawer/summary?till=1');
    expect(status).toBe(200);
    expect(summary.summary.totalSessions).toBe(1);
    expect(summary.summary.totalFloat).toBe(100);
    expect(summary.summary.totalClose).toBe(105);
  });

  test('GET /api/drawer/summary works with multiple closed sessions', async () => {
    for (let i = 0; i < 3; i++) {
      const { data: open } = await app.client.request(
        '/api/drawer/open',
        { method: 'POST', body: JSON.stringify({ floatAmount: 50, till: 1 }) }
      );
      await app.client.request(
        `/api/drawer/${open.session.id}/close`,
        { method: 'POST', body: JSON.stringify({ countedCash: 55 + i }) }
      );
    }

    const { status, data: summary } = await app.client.request('/api/drawer/summary?till=1');
    expect(status).toBe(200);
    expect(summary.summary.totalSessions).toBe(3);
    expect(summary.summary.totalFloat).toBe(150);
    expect(summary.summary.totalClose).toBe(55 + 56 + 57);
  });

  test('GET /api/drawer/summary works with no sessions', async () => {
    const { status, data: summary } = await app.client.request('/api/drawer/summary?till=99');
    expect(status).toBe(200);
    expect(summary.summary.totalSessions).toBe(0);
  });

  test('create drawer session with till=5 succeeds (no FK constraint)', async () => {
    const { status, data } = await app.client.request(
      '/api/drawer/open',
      { method: 'POST', body: JSON.stringify({ floatAmount: 200, till: 5 }) }
    );
    expect(status).toBe(200);
    expect(data.session.till).toBe(5);
  });
});
