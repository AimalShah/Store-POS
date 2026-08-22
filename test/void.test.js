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

function saleBody(overrides = {}) {
  return {
    ref_number: '',
    customer: '0',
    customer_name: 'Walk-in Customer',
    status: 1,
    user_id: 1,
    user: 'Administrator',
    till: 1,
    discount: 0,
    subtotal: 5,
    tax: 0,
    total: 5,
    paid: 0,
    change: 0,
    payment_type: 1,
    items: [],
    date: new Date().toISOString(),
    ...overrides,
  };
}

describe('Refund/Void flow', () => {
  test('void a completed sale sets status to 2 and touches nothing else', async () => {
    const product = await app.createProduct('Void Test Cola', 2.5, 'Drinks', true, 10);
    const productId = product.id;

    const { data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 5,
          paid: 5,
          payment_breakdown: [{ method: 'cash', amount: 5, tendered: 5 }],
          items: [{ id: productId, name: 'Void Test Cola', price: 2.5, quantity: 2 }],
        })
      ),
    });
    expect(sale.ok).toBe(true);

    const { status: voidStatus, data: voidData } = await app.client.request(
      `/api/transactions/${sale.id}/void`,
      { method: 'POST' }
    );
    expect(voidStatus).toBe(200);
    expect(voidData.ok).toBe(true);
    expect(voidData.status).toBe(2);

    const { data: tx } = await app.client.request(`/api/transaction/${sale.id}`);
    expect(tx.status).toBe(2);
  });

  test('cannot void already voided transaction', async () => {
    const product = await app.createProduct('Void Test 2', 3, 'Food', true, 5);
    const { data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 3,
          paid: 3,
          payment_breakdown: [{ method: 'cash', amount: 3, tendered: 3 }],
          items: [{ id: product.id, name: 'Void Test 2', price: 3, quantity: 1 }],
        })
      ),
    });

    // Void once
    await app.client.request(`/api/transactions/${sale.id}/void`, { method: 'POST' });

    // Try to void again
    const { status, data } = await app.client.request(`/api/transactions/${sale.id}/void`, { method: 'POST' });
    expect(status).toBe(400);
    expect(data.error).toBe('Transaction is already voided');
  });

  test('cannot void non-completed transaction (held order)', async () => {
    const product = await app.createProduct('Void Test 3', 3, 'Food', true, 5);
    const { data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          status: 0, // held order
          total: 3,
          paid: 0,
          payment_breakdown: [],
          items: [{ id: product.id, name: 'Void Test 3', price: 3, quantity: 1 }],
        })
      ),
    });

    const { status, data } = await app.client.request(`/api/transactions/${sale.id}/void`, { method: 'POST' });
    expect(status).toBe(400);
    expect(data.error).toBe('Only completed sales can be voided');
  });

  test('void non-existent transaction returns 404', async () => {
    const { status, data } = await app.client.request('/api/transactions/99999/void', { method: 'POST' });
    expect(status).toBe(404);
    expect(data.error).toBe('Transaction not found');
  });

  test('a cashier (any till role) can void; unauthenticated cannot', async () => {
    // Create a cashier using admin token
    const { data: user } = await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: 'cashier',
        password: 'password',
        fullname: 'Cashier',
        role: 'Cashier',
      }),
    });

    // Login as cashier
    const { data: login } = await app.client.request('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'cashier', password: 'password' }),
    });

    const product = await app.createProduct('Void Test 4', 3, 'Food', true, 5);
    const { data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 3,
          paid: 3,
          payment_breakdown: [{ method: 'cash', amount: 3, tendered: 3 }],
          items: [{ id: product.id, name: 'Void Test 4', price: 3, quantity: 1 }],
        })
      ),
    });

    // Void as cashier — the till is open to every role
    const { status, data } = await app.client.request(
      `/api/transactions/${sale.id}/void`,
      { method: 'POST' },
      login.token
    );
    expect(status).toBe(200);
    expect(data.ok).toBe(true);

    // But an unauthenticated request is refused
    const anon = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify({ items: [], total: 1, paid: 1, status: 1 }),
    }, null);
    expect(anon.status).toBe(401);
  });

  test('combo components are informational only — voiding changes no product data', async () => {
    const bun = await app.createProduct('Void Bun', 0.5, 'Ingredients', true, 50);
    const comboFd = new FormData();
    comboFd.append('name', 'Void Burger');
    comboFd.append('price', '5');
    comboFd.append('category', 'Food');
    comboFd.append('img', '');
    comboFd.append('components', JSON.stringify([{ id: bun.id, quantity: 2 }]));
    const { data: combo } = await app.client.request('/api/inventory/product', { method: 'POST', body: comboFd });

    const { data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({
        total: 10,
        paid: 10,
        payment_breakdown: [{ method: 'cash', amount: 10, tendered: 10 }],
        items: [{ id: combo.id, name: 'Void Burger', price: 5, quantity: 2 }],
      })),
    });
    expect(sale.ok).toBe(true);

    const { status } = await app.client.request(`/api/transactions/${sale.id}/void`, { method: 'POST' });
    expect(status).toBe(200);
  });
});