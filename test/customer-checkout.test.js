import { bootApp } from './helpers.js';

let app;
beforeEach(async () => {
  app = await bootApp();
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
    subtotal: 10,
    tax: 0,
    total: 10,
    paid: 10,
    change: 0,
    payment_type: 1,
    payment_breakdown: [{ method: 'cash', amount: 10 }],
    items: [],
    date: new Date().toISOString(),
    ...overrides,
  };
}

describe('Customer / Walk-in / Fulfillment on checkout', () => {
  test('new orders default to Walk-in regardless of fulfillment', async () => {
    await app.client.login();
    const { data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({ fulfillment: 'takeaway' })),
    });
    expect(sale.ok).toBe(true);

    const { data: tx } = await app.client.request(`/api/transaction/${sale.id}`);
    expect(tx.customer).toBe('0');
    expect(tx.customer_name).toBe('Walk-in Customer');
  });

  test('delivery cannot complete without a chosen customer or full one-time details', async () => {
    await app.client.login();

    const missing = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({ fulfillment: 'delivery' })),
    });
    expect(missing.status).toBe(400);
    expect(missing.data.error).toMatch(/delivery/i);

    const partial = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({ fulfillment: 'delivery', delivery_name: 'Ayesha', delivery_contact: '0300' })
      ),
    });
    expect(partial.status).toBe(400);
  });

  test('full one-time details complete the delivery and attach only to the Sale — never the customers book', async () => {
    await app.client.login();
    const { data: before } = await app.client.request('/api/customers/all');

    const { status, data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          fulfillment: 'delivery',
          delivery_name: 'Ayesha One-Time',
          delivery_contact: '03001234567',
          delivery_address: '12 Model Town',
        })
      ),
    });
    expect(status).toBe(200);
    expect(sale.ok).toBe(true);

    const { data: tx } = await app.client.request(`/api/transaction/${sale.id}`);
    expect(tx.delivery_name).toBe('Ayesha One-Time');
    expect(tx.delivery_contact).toBe('03001234567');
    expect(tx.delivery_address).toBe('12 Model Town');
    expect(tx.customer).toBe('0');

    const { data: after } = await app.client.request('/api/customers/all');
    expect(after.length).toBe(before.length);
    expect(after.some((c) => c.name === 'Ayesha One-Time')).toBe(false);
  });

  test('a chosen saved customer completes a delivery and the Sale reflects them', async () => {
    await app.client.login();
    await app.client.request('/api/customers/customer', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bilal Saved', phone: '0345' }),
    });
    const { data: customers } = await app.client.request('/api/customers/all');
    const bilal = customers.find((c) => c.name === 'Bilal Saved');

    const { status, data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({ fulfillment: 'delivery', customer: String(bilal.id), customer_name: bilal.name })),
    });
    expect(status).toBe(200);

    const { data: tx } = await app.client.request(`/api/transaction/${sale.id}`);
    expect(tx.customer).toBe(String(bilal.id));
    expect(tx.customer_name).toBe('Bilal Saved');
  });

  test('dine-in and takeaway complete fine as Walk-in; held orders are exempt from the delivery gate', async () => {
    await app.client.login();

    for (const fulfillment of ['dine-in', 'takeaway']) {
      const { status } = await app.client.request('/api/new', {
        method: 'POST',
        body: JSON.stringify(saleBody({ fulfillment })),
      });
      expect(status).toBe(200);
    }

    // A parked (held) order may be incomplete until resumed
    const { status } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(saleBody({ fulfillment: 'delivery', status: 0 })),
    });
    expect(status).toBe(200);
  });
});
