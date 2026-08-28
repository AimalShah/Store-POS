import { bootApp } from './helpers.js';

function cashSale(amount) {
  return {
    status: 1,
    till: 1,
    total: amount,
    paid: amount,
    payment_type: 1,
    payment_breakdown: [{ method: 'cash', amount }],
    items: [],
  };
}

let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Drawer running balance', () => {
  test('a completed cash Sale increases the active drawer balance', async () => {
    await app.client.request('/api/drawer/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 100, till: 1 }),
    });

    const { status: saleStatus } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(cashSale(50)),
    });
    expect(saleStatus).toBe(200);

    const { status, data } = await app.client.request('/api/drawer/open?till=1');
    expect(status).toBe(200);
    expect(data.session.runningBalance).toBe(150);
  });

  test('card and mobile Sales do not increase the active drawer balance', async () => {
    await app.client.request('/api/drawer/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 100, till: 1 }),
    });

    for (const method of ['card', 'mobile']) {
      await app.client.request('/api/new', {
        method: 'POST',
        body: JSON.stringify({
          ...cashSale(50),
          payment_type: method === 'card' ? 2 : 3,
          payment_breakdown: [{ method, amount: 50 }],
        }),
      });
    }

    const { data } = await app.client.request('/api/drawer/open?till=1');
    expect(data.session.runningBalance).toBe(100);
  });

  test('a split Sale increases the active drawer balance by only its cash payment', async () => {
    await app.client.request('/api/drawer/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 100, till: 1 }),
    });

    await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({
        ...cashSale(50),
        payment_breakdown: [
          { method: 'cash', amount: 20 },
          { method: 'card', amount: 30 },
        ],
      }),
    });

    const { data } = await app.client.request('/api/drawer/open?till=1');
    expect(data.session.runningBalance).toBe(120);
  });

  test('closing a drawer calculates variance from its running balance', async () => {
    const { data: opened } = await app.client.request('/api/drawer/open', {
      method: 'POST',
      body: JSON.stringify({ floatAmount: 100, till: 1 }),
    });
    await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(cashSale(50)),
    });

    const { data } = await app.client.request(`/api/drawer/${opened.session.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ countedCash: 145 }),
    });
    expect(data.session.runningBalance).toBe(150);
    expect(data.session.variance).toBe(5);
  });
});
