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

async function makeProduct(name, price, category) {
  const data = await app.createProduct(name, price, category, true, 50);
  return data.id;
}

async function makeOrder({ items, total, status = 1, fulfillment = 'delivery', delivery } = {}) {
  await app.client.login();
  const { data } = await app.client.request('/api/new', {
    method: 'POST',
    body: JSON.stringify({
      ref_number: '',
      customer: '0',
      customer_name: 'Walk-in Customer',
      status,
      user_id: 1,
      user: 'Administrator',
      till: 1,
      discount: 0,
      subtotal: total,
      tax: 0,
      total,
      paid: status === 1 ? total : 0,
      change: 0,
      payment_type: 1,
      payment_breakdown: [{ method: 'cash', amount: status === 1 ? total : 0 }],
      items,
      fulfillment,
      delivery_name: delivery?.name || '',
      delivery_contact: delivery?.contact || '',
      delivery_address: delivery?.address || '',
      date: new Date().toISOString(),
    }),
  });
  return data;
}

describe('Fulfillment persistence', () => {
  test('completed sale retains fulfillment and delivery details after reload', async () => {
    const cola = await makeProduct('Cola', 2, 'Drinks');
    const { id } = await makeOrder({
      items: [{ id: cola, name: 'Cola', price: 2, quantity: 1 }],
      total: 2,
      fulfillment: 'delivery',
      delivery: { name: 'Jane', contact: '0771', address: '1 Main St' },
    });

    const { data: tx } = await app.client.request(`/api/transaction/${id}`);

    expect(tx.fulfillment).toBe('delivery');
    expect(tx.delivery_name).toBe('Jane');
    expect(tx.delivery_contact).toBe('0771');
    expect(tx.delivery_address).toBe('1 Main St');
  });

  test('held order restores its fulfillment selection', async () => {
    const fries = await makeProduct('Fries', 3, 'Food');
    const { id } = await makeOrder({
      items: [{ id: fries, name: 'Fries', price: 3, quantity: 1 }],
      total: 3,
      status: 0,
      fulfillment: 'dine-in',
    });

    const { data: tx } = await app.client.request(`/api/transaction/${id}`);

    expect(tx.status).toBe(0);
    expect(tx.fulfillment).toBe('dine-in');
  });
});
