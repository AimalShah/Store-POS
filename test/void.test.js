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
  test('void a completed sale restores stock and sets status to 2', async () => {
    // Create a tracked product
    const product = await app.createProduct('Void Test Cola', 2.5, 'Drinks', true, 10);
    const productId = product.id;

    // Make a sale
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

    // Verify stock was decremented
    const { data: productsBeforeVoid } = await app.client.request('/api/inventory/products');
    const productBeforeVoid = productsBeforeVoid.find((p) => p.id === productId);
    expect(productBeforeVoid.quantity).toBe(8); // 10 - 2

    // Void the sale
    const { status: voidStatus, data: voidData } = await app.client.request(
      `/api/transactions/${sale.id}/void`,
      { method: 'POST' }
    );
    expect(voidStatus).toBe(200);
    expect(voidData.ok).toBe(true);
    expect(voidData.status).toBe(2);

    // Verify transaction status is 2
    const { data: tx } = await app.client.request(`/api/transaction/${sale.id}`);
    expect(tx.status).toBe(2);

    // Verify stock was restored
    const { data: productsAfterVoid } = await app.client.request('/api/inventory/products');
    const productAfterVoid = productsAfterVoid.find((p) => p.id === productId);
    expect(productAfterVoid.quantity).toBe(10); // Restored to 10

    // Verify stock movement records
    const { data: movements } = await app.client.request(`/api/inventory/stock-movements?productId=${productId}`);
    const restockMovements = movements.movements.filter((m) => m.type === 'restock');
    expect(restockMovements.length).toBeGreaterThan(0);
    expect(restockMovements.some((m) => m.quantityChange === 2)).toBe(true);
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

  test('non-admin without perm_transactions cannot void', async () => {
    // Create a user without perm_transactions using admin token
    const { data: user } = await app.client.request('/api/users/post', {
      method: 'POST',
      body: JSON.stringify({
        username: 'cashier',
        password: 'password',
        fullname: 'Cashier',
        perm_products: 0,
        perm_categories: 0,
        perm_transactions: 0,
        perm_users: 0,
        perm_settings: 0,
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

    // Try to void as cashier
    const { status, data } = await app.client.request(
      `/api/transactions/${sale.id}/void`,
      { method: 'POST' },
      login.token
    );
    expect(status).toBe(403);
  });

  test('void restores component stock for combo meals', async () => {
    // Create component products
    const bun = await app.createProduct('Void Bun', 0.5, 'Ingredients', true, 50);
    const patty = await app.createProduct('Void Patty', 1.0, 'Ingredients', true, 30);

    // Create combo
    const comboFd = new FormData();
    comboFd.append('name', 'Void Burger');
    comboFd.append('price', '5');
    comboFd.append('cost', '1.5');
    comboFd.append('category', 'Food');
    comboFd.append('quantity', '10');
    comboFd.append('stock', '0');
    comboFd.append('img', '');
    comboFd.append('components', JSON.stringify([
      { id: bun.id, quantity: 2 },
      { id: patty.id, quantity: 1 },
    ]));
    const { data: combo } = await app.client.request('/api/inventory/product', { method: 'POST', body: comboFd });

    // Sell 2 combos
    const { data: sale } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 10,
          paid: 10,
          payment_breakdown: [{ method: 'cash', amount: 10, tendered: 10 }],
          items: [{ id: combo.id, name: 'Void Burger', price: 5, quantity: 2 }],
        })
      ),
    });

    // Verify component stock decremented
    let { data: productsRes } = await app.client.request('/api/inventory/products');
    const products = Array.isArray(productsRes) ? productsRes : productsRes.products || [];
    console.log('Products before void:', products.map(p => ({id: p.id, name: p.name, qty: p.quantity})));
    let bunAfter = products.find((p) => p.id === bun.id);
    let pattyAfter = products.find((p) => p.id === patty.id);
    expect(bunAfter).toBeDefined();
    expect(pattyAfter).toBeDefined();
    expect(bunAfter.quantity).toBe(46); // 50 - 4
    expect(pattyAfter.quantity).toBe(28); // 30 - 2

    // Void the sale
    const voidResult = await app.client.request(`/api/transactions/${sale.id}/void`, { method: 'POST' });
    console.log('Void result:', voidResult);

    // Verify component stock restored
    productsRes = await app.client.request('/api/inventory/products');
    const productsAfter = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.products || [];
    console.log('Products after void:', productsAfter.map(p => ({id: p.id, name: p.name, qty: p.quantity})));
    bunAfter = productsAfter.find((p) => p.id === bun.id);
    pattyAfter = productsAfter.find((p) => p.id === patty.id);
    expect(bunAfter).toBeDefined();
    expect(pattyAfter).toBeDefined();
    expect(bunAfter.quantity).toBe(50);
    expect(pattyAfter.quantity).toBe(30);
  });
});