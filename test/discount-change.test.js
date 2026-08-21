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

describe('Discount and change validation', () => {
  test('rejects transaction with negative discount', async () => {
    const { status, data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({ discount: -10, total: 5, payment_breakdown: [{ method: 'cash', amount: 5 }] })),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('Discount cannot be negative');
  });

  test('accepts transaction with zero discount', async () => {
    const { status, data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({ discount: 0, total: 5, payment_breakdown: [{ method: 'cash', amount: 5 }] })),
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });

  test('accepts transaction with positive discount', async () => {
    const { status, data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({ discount: 2, total: 3, payment_breakdown: [{ method: 'cash', amount: 3 }] })),
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });

  test('rejects product with negative price', async () => {
    const fd = new FormData();
    fd.append('name', 'Bad Product');
    fd.append('price', '-5');
    fd.append('cost', '2');
    fd.append('category', 'Food');
    fd.append('quantity', '10');
    fd.append('stock', '0');
    fd.append('img', '');

    const { status, data } = await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    expect(status).toBe(400);
    expect(data.error).toBe('Price and cost cannot be negative');
  });

  test('rejects product with negative cost', async () => {
    const fd = new FormData();
    fd.append('name', 'Bad Product');
    fd.append('price', '5');
    fd.append('cost', '-2');
    fd.append('category', 'Food');
    fd.append('quantity', '10');
    fd.append('stock', '0');
    fd.append('img', '');

    const { status, data } = await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    expect(status).toBe(400);
    expect(data.error).toBe('Price and cost cannot be negative');
  });

  test('accepts product with positive price and cost', async () => {
    const fd = new FormData();
    fd.append('name', 'Good Product');
    fd.append('price', '5');
    fd.append('cost', '2');
    fd.append('category', 'Food');
    fd.append('quantity', '10');
    fd.append('stock', '0');
    fd.append('img', '');

    const { status, data } = await app.client.request('/api/inventory/product', { method: 'POST', body: fd });
    expect(status).toBe(200);
    expect(data.name).toBe('Good Product');
  });

  test('change calculation matches frontend tendered-based logic', async () => {
    // Cash tendered 15 for total 10 -> change should be 5 (tendered - amount for cash line)
    const { data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 10,
          payment_breakdown: [{ method: 'cash', amount: 10, tendered: 15 }],
        })
      ),
    });

    expect(data.ok).toBe(true);

    const { data: tx } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.change).toBe(5); // 15 - 10 = 5
  });

  test('change is zero when cash tendered equals amount', async () => {
    const { data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 10,
          payment_breakdown: [{ method: 'cash', amount: 10, tendered: 10 }],
        })
      ),
    });

    const { data: tx } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.change).toBe(0);
  });

  test('change only on cash lines, not card/mobile', async () => {
    // Cash 5 (tendered 5), Card 5 -> total 10, no change
    const { data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 10,
          payment_breakdown: [
            { method: 'cash', amount: 5, tendered: 5 },
            { method: 'card', amount: 5 },
          ],
        })
      ),
    });

    const { data: tx } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.change).toBe(0);
  });

  test('split cash payments sum change correctly', async () => {
    // Two cash lines: tendered 8 (amount 5) + tendered 5 (amount 5) -> total 10, change 3+0=3
    const { data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 10,
          payment_breakdown: [
            { method: 'cash', amount: 5, tendered: 8 },
            { method: 'cash', amount: 5, tendered: 5 },
          ],
        })
      ),
    });

    const { data: tx } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.change).toBe(3); // (8-5) + (5-5) = 3
  });

  test('rejects transaction with negative item discount', async () => {
    const { status, data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 5,
          payment_breakdown: [{ method: 'cash', amount: 5 }],
          items: [{ id: 1, name: 'Test', price: 5, quantity: 1, discountValue: -2 }],
        })
      ),
    });
    expect(status).toBe(400);
    expect(data.error).toBe('Item discount cannot be negative');
  });

  test('accepts transaction with positive item discount', async () => {
    const { status, data } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 3,
          payment_breakdown: [{ method: 'cash', amount: 3 }],
          items: [{ id: 1, name: 'Test', price: 5, quantity: 1, discountValue: 2 }],
        })
      ),
    });
    expect(status).toBe(200);
    expect(data.ok).toBe(true);
  });
});