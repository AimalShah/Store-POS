import { bootApp } from './helpers.js';

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

let app;
beforeEach(async () => {
  app = await bootApp();
  await app.client.login();
});
afterEach(async () => {
  await app.close();
  app.cleanup();
});

describe('Checkout: split payment + change on cash line', () => {
  test('stores the payment breakdown and sums paid from its parts', async () => {
    const { data } = await app.client.request(
      '/api/new',
      {
        method: 'POST',
        body: JSON.stringify(
          saleBody({
            payment_breakdown: [
              { method: 'cash', amount: 3 },
              { method: 'card', amount: 2 },
            ],
          })
        ),
      }
    );

    expect(data.ok).toBe(true);
    expect(/^INV-\d{8}-\d{3}$/.test(data.ref_number)).toBe(true);

    const { data: tx } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.payment_breakdown).toEqual([
      { method: 'cash', amount: 3 },
      { method: 'card', amount: 2 },
    ]);
    expect(tx.paid).toBe(5);
  });

  test('change is computed only on the cash line (cash overpaid)', async () => {
    const { data } = await app.client.request(
      '/api/new',
      {
        method: 'POST',
        body: JSON.stringify(
          saleBody({
            payment_breakdown: [{ method: 'cash', amount: 5, tendered: 7 }],
          })
        ),
      }
    );

    const { data: tx } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.change).toBe(2);
  });

  test('change is zero when cash line does not cover the total', async () => {
    const { data } = await app.client.request(
      '/api/new',
      {
        method: 'POST',
        body: JSON.stringify(
          saleBody({
            payment_breakdown: [
              { method: 'cash', amount: 3 },
              { method: 'card', amount: 2 },
            ],
          })
        ),
      }
    );

    const { data: tx } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.change).toBe(0);
  });

  test('change is zero when no cash is used', async () => {
    const { data } = await app.client.request(
      '/api/new',
      {
        method: 'POST',
        body: JSON.stringify(
          saleBody({
            payment_breakdown: [
              { method: 'card', amount: 3 },
              { method: 'mobile', amount: 2 },
            ],
          })
        ),
      }
    );

    const { data: tx = {} } = await app.client.request(`/api/transaction/${data.id}`);
    expect(tx.change).toBe(0);
  });

  test('deducts stock for tracked products on paid completion', async () => {
    const created = await app.createProduct('Stocked Cola', 2.5, 'Drinks', true, 10);
    const productId = created.id;

    await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 5,
          paid: 5,
          payment_breakdown: [{ method: 'cash', amount: 5 }],
          items: [{ id: productId, name: 'Stocked Cola', price: 2.5, quantity: 2 }],
        })
      ),
    });

    const { data: products } = await app.client.request('/api/inventory/products');
    const after = products.find((p) => p.id === productId);
    expect(after.quantity).toBe(8);

    const { data: movements } = await app.client.request(
      '/api/inventory/stock-movements?productId=' + productId
    );
    expect(movements.movements.some((m) => m.type === 'sale' && m.quantityChange === -2)).toBe(
      true
    );
  });

  test('does not deduct stock for untracked products', async () => {
    const created = await app.createProduct('Fresh Fries', 3, 'Food', false, 10);
    const productId = created.id;

    await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 3,
          paid: 3,
          payment_breakdown: [{ method: 'cash', amount: 3 }],
          items: [{ id: productId, name: 'Fresh Fries', price: 3, quantity: 1 }],
        })
      ),
    });

    const { data: products } = await app.client.request('/api/inventory/products');
    const after = products.find((p) => p.id === productId);
    expect(after.quantity).toBe(10);
  });
});
