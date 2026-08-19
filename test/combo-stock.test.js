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

describe('Combo meals: component stock decrement', () => {
  test('selling a product with components decrements each component stock', async () => {
    // Create component products (tracked)
    const bun = await app.createProduct('Burger Bun', 0.5, 'Ingredients', true, 100);
    const patty = await app.createProduct('Beef Patty', 1.0, 'Ingredients', true, 50);

    // Create combo product with components
    const comboFd = new FormData();
    comboFd.append('name', 'Burger Combo');
    comboFd.append('price', '5');
    comboFd.append('cost', '1.5');
    comboFd.append('category', 'Food');
    comboFd.append('quantity', '20');
    comboFd.append('stock', '0'); // combo itself not tracked, components are
    comboFd.append('img', '');
    comboFd.append('components', JSON.stringify([
      { id: bun.id, quantity: 2 }, // 2 buns per burger
      { id: patty.id, quantity: 1 }, // 1 patty per burger
    ]));
    const { data: combo } = await app.client.request('/api/inventory/product', { method: 'POST', body: comboFd });

    // Sell 3 combos
    await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 15,
          paid: 15,
          payment_breakdown: [{ method: 'cash', amount: 15, tendered: 15 }],
          items: [{ id: combo.id, name: 'Burger Combo', price: 5, quantity: 3 }],
        })
      ),
    });

    // Check component stock: buns should be 100 - 3*2 = 94, patties 50 - 3*1 = 47
    const { data: products } = await app.client.request('/api/inventory/products');
    const bunAfter = products.find((p) => p.id === bun.id);
    const pattyAfter = products.find((p) => p.id === patty.id);

    expect(bunAfter.quantity).toBe(94);
    expect(pattyAfter.quantity).toBe(47);
  });

  test('stock_movements records created for components (parent not tracked)', async () => {
    const cheese = await app.createProduct('Cheese Slice', 0.3, 'Ingredients', true, 200);
    const meat = await app.createProduct('Meat', 2.0, 'Ingredients', true, 100);

    const comboFd = new FormData();
    comboFd.append('name', 'Cheese Burger');
    comboFd.append('price', '6');
    comboFd.append('cost', '2.3');
    comboFd.append('category', 'Food');
    comboFd.append('quantity', '10');
    comboFd.append('stock', '0'); // parent not tracked
    comboFd.append('img', '');
    comboFd.append('components', JSON.stringify([
      { id: cheese.id, quantity: 1 },
      { id: meat.id, quantity: 2 },
    ]));
    const { data: combo } = await app.client.request('/api/inventory/product', { method: 'POST', body: comboFd });

    // Sell 2 combos
    await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 12,
          paid: 12,
          payment_breakdown: [{ method: 'cash', amount: 12, tendered: 12 }],
          items: [{ id: combo.id, name: 'Cheese Burger', price: 6, quantity: 2 }],
        })
      ),
    });

    // Parent is not tracked (stock=0), so no stock movement for it
    // Check stock movements for cheese
    const { data: cheeseMovements } = await app.client.request(`/api/inventory/stock-movements?productId=${cheese.id}`);
    expect(cheeseMovements.movements.some((m) => m.type === 'sale' && m.quantityChange === -2)).toBe(true);

    // Check stock movements for meat
    const { data: meatMovements } = await app.client.request(`/api/inventory/stock-movements?productId=${meat.id}`);
    expect(meatMovements.movements.some((m) => m.type === 'sale' && m.quantityChange === -4)).toBe(true);
  });

  test('component stock respects quantity multiplier', async () => {
    const sauce = await app.createProduct('Special Sauce', 0.2, 'Ingredients', true, 50);

    const comboFd = new FormData();
    comboFd.append('name', 'Saucy Burger');
    comboFd.append('price', '4');
    comboFd.append('cost', '1');
    comboFd.append('category', 'Food');
    comboFd.append('quantity', '10');
    comboFd.append('stock', '0');
    comboFd.append('img', '');
    comboFd.append('components', JSON.stringify([
      { id: sauce.id, quantity: 3 }, // 3 units of sauce per burger
    ]));
    const { data: combo } = await app.client.request('/api/inventory/product', { method: 'POST', body: comboFd });

    // Sell 5 combos -> 5 * 3 = 15 sauce
    await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 20,
          paid: 20,
          payment_breakdown: [{ method: 'cash', amount: 20, tendered: 20 }],
          items: [{ id: combo.id, name: 'Saucy Burger', price: 4, quantity: 5 }],
        })
      ),
    });

    const { data: products } = await app.client.request('/api/inventory/products');
    const sauceAfter = products.find((p) => p.id === sauce.id);
    expect(sauceAfter.quantity).toBe(35); // 50 - 15 = 35
  });

  test('component with stock=0 (tracked) handles gracefully', async () => {
    // Component with 0 stock
    const rare = await app.createProduct('Rare Item', 10, 'Ingredients', true, 0);

    const comboFd = new FormData();
    comboFd.append('name', 'Rare Burger');
    comboFd.append('price', '20');
    comboFd.append('cost', '10');
    comboFd.append('category', 'Food');
    comboFd.append('quantity', '5');
    comboFd.append('stock', '0');
    comboFd.append('img', '');
    comboFd.append('components', JSON.stringify([
      { id: rare.id, quantity: 1 },
    ]));
    const { data: combo } = await app.client.request('/api/inventory/product', { method: 'POST', body: comboFd });

    // Sell 1 combo - should not crash, component stock stays at 0
    const { status } = await app.client.request('/api/new', {
      method: 'POST',
      body: JSON.stringify(
        saleBody({
          total: 20,
          paid: 20,
          payment_breakdown: [{ method: 'cash', amount: 20, tendered: 20 }],
          items: [{ id: combo.id, name: 'Rare Burger', price: 20, quantity: 1 }],
        })
      ),
    });

    expect(status).toBe(200);

    const { data: products } = await app.client.request('/api/inventory/products');
    const rareAfter = products.find((p) => p.id === rare.id);
    expect(rareAfter.quantity).toBe(0); // Still 0, doesn't go negative
  });
});